/**
 * Run: node backfill-kafka.mjs
 * Reads all rows from each Hopecard table in Supabase and publishes them to Kafka via the SDK.
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env ────────────────────────────────────────────────────────────────
const envContent = readFileSync(resolve(__dirname, '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = value;
}

const require = createRequire(import.meta.url);
const { TribeClient } = require('./node_modules/@implementsprint/sdk/dist/index.js');

const GATEWAY_URL    = process.env.APICENTER_URL;
const TRIBE_ID       = process.env.APICENTER_TRIBE_ID;
const SECRET         = process.env.APICENTER_TRIBE_SECRET;
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE_SIZE      = 100;
const DRY_RUN        = process.argv.includes('--dry-run');

if (!GATEWAY_URL || !TRIBE_ID || !SECRET) {
  console.error('❌  Missing APICENTER_URL / APICENTER_TRIBE_ID / APICENTER_TRIBE_SECRET in .env');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// ── Table definitions ─────────────────────────────────────────────────────────
// All rows publish to the governed events topic; eventType differentiates the table.
const EVENTS_TOPIC = `tribe.${process.env.APICENTER_TRIBE_ID}.events`;

const TABLES = [
  { table: 'activity_logs',            eventType: 'hopecard.backfill.activity_log',              orderBy: 'created_at' },
  { table: 'beneficiaries',            eventType: 'hopecard.backfill.beneficiary',               orderBy: 'id' },
  { table: 'beneficiary_profiles',     eventType: 'hopecard.backfill.beneficiary_profile',       orderBy: 'created_at' },
  { table: 'beneficiary_transactions', eventType: 'hopecard.backfill.beneficiary_transaction',   orderBy: 'created_at' },
  { table: 'beneficiary_withdrawals',  eventType: 'hopecard.backfill.beneficiary_withdrawal',    orderBy: 'created_at' },
  { table: 'campaign_manager_profiles',eventType: 'hopecard.backfill.campaign_manager_profile',  orderBy: 'created_at' },
  { table: 'cart_items',               eventType: 'hopecard.backfill.cart_item',                 orderBy: 'id' },
  { table: 'carts',                    eventType: 'hopecard.backfill.cart',                      orderBy: 'id' },
  { table: 'digital_donor_profiles',   eventType: 'hopecard.backfill.digital_donor_profile',     orderBy: 'created_at' },
  { table: 'hc_campaigns',             eventType: 'hopecard.backfill.campaign',                  orderBy: 'created_at' },
  { table: 'hopecard_purchases',       eventType: 'hopecard.backfill.purchase',                  orderBy: 'purchased_at' },
  { table: 'hopecard_redemptions',     eventType: 'hopecard.backfill.redemption',                orderBy: 'id' },
  { table: 'hopecards',                eventType: 'hopecard.backfill.hopecard',                  orderBy: 'id' },
];

// ── Supabase fetch helper ─────────────────────────────────────────────────────
async function fetchPage(table, orderBy, offset) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=${orderBy}.asc&limit=${PAGE_SIZE}&offset=${offset}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase ${table} HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n🚀  Hopecard Kafka Backfill  ${DRY_RUN ? '[DRY RUN]' : ''}`);
  console.log(`    Gateway : ${GATEWAY_URL}`);
  console.log(`    Tribe   : ${TRIBE_ID}`);
  console.log(`    Tables  : ${TABLES.length}\n`);

  const client = new TribeClient({ gatewayUrl: GATEWAY_URL, tribeId: TRIBE_ID, secret: SECRET });

  process.stdout.write('Authenticating with API-Center... ');
  await client.authenticate();
  console.log('✅\n');

  const summary = [];

  for (const config of TABLES) {
    let published = 0, failed = 0, offset = 0;

    process.stdout.write(`  ${config.table.padEnd(30)} → ${EVENTS_TOPIC} [${config.eventType}]\n`);

    while (true) {
      let rows;
      try {
        rows = await fetchPage(config.table, config.orderBy, offset);
      } catch (err) {
        console.error(`    ❌  Failed to fetch at offset ${offset}: ${err.message}`);
        break;
      }

      if (!rows.length) break;

      for (const row of rows) {
        const rowId = String(row.id ?? offset);

        if (DRY_RUN) {
          published++;
          continue;
        }

        try {
          await client.kafkaPublish({
            topic: EVENTS_TOPIC,
            key: rowId,
            eventType: config.eventType,
            payload: row,
            metadata: { system: 'hopecard', sourceTable: config.table },
            sourceServiceId: 'hopecard-admin-service',
          });
          published++;
        } catch (err) {
          failed++;
          console.error(`    ⚠️   Row ${rowId} failed: ${err?.message}`);
        }
      }

      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    console.log(`    ✅  published: ${published}  failed: ${failed}`);
    summary.push({ table: config.table, published, failed });
  }

  console.log('\n── Summary ──────────────────────────────────────');
  for (const s of summary) {
    console.log(`  ${s.table.padEnd(30)}  published: ${s.published}  failed: ${s.failed}`);
  }
  const total = summary.reduce((a, s) => a + s.published, 0);
  const totalFailed = summary.reduce((a, s) => a + s.failed, 0);
  console.log(`\n  Total published : ${total}`);
  console.log(`  Total failed    : ${totalFailed}`);
  console.log('\n✅  Backfill complete.\n');
}

run().catch((err) => {
  console.error('\n❌  FAILED:', err?.response?.data ?? err?.message ?? err);
  process.exit(1);
});
