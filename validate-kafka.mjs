/**
 * Run: node validate-kafka.mjs
 * Validates: SDK auth → API-Center reachability → Kafka topic catalog → test event publish
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { TribeClient } = require('./@implementsprint/sdk/dist/index.js') ?? require('./node_modules/@implementsprint/sdk/dist/index.js');

const GATEWAY_URL   = process.env.APICENTER_URL          || 'https://api-center-test.itsandbox.site';
const TRIBE_ID      = process.env.APICENTER_TRIBE_ID     || 'trinithrive';
const SECRET        = process.env.APICENTER_TRIBE_SECRET || '';

if (!SECRET) {
  console.error('❌  APICENTER_TRIBE_SECRET is not set. Pass it via env:\n  $env:APICENTER_TRIBE_SECRET="<secret>"; node validate-kafka.mjs');
  process.exit(1);
}

const client = new TribeClient({ gatewayUrl: GATEWAY_URL, tribeId: TRIBE_ID, secret: SECRET });

async function run() {
  // ── Step 1: Authenticate ──────────────────────────────────────────
  process.stdout.write('1. Authenticating with API-Center... ');
  await client.authenticate();
  console.log('✅  OK  (token acquired)');

  // ── Step 2: Kafka governance catalog (proves Kafka is reachable) ──
  process.stdout.write('2. Fetching Kafka governance catalog... ');
  const catalog = await client.kafkaGetGovernanceCatalog();
  const topicCount = catalog?.topics?.length ?? Object.keys(catalog ?? {}).length;
  console.log(`✅  OK  (${topicCount} topic(s) registered)`);
  console.log('   Topics:', JSON.stringify(catalog, null, 2).split('\n').slice(0, 20).join('\n'));

  // ── Step 3: Publish a test event ─────────────────────────────────
  process.stdout.write('3. Publishing test event (hopecard.validation.ping)... ');
  const result = await client.publishTribeEvent({
    eventType: 'hopecard.validation.ping',
    payload: { test: true, ts: new Date().toISOString() },
    metadata: { system: 'hopecard', eventVersion: '1' },
  });
  console.log('✅  OK');
  console.log('   Response:', JSON.stringify(result));

  console.log('\n✅  All checks passed — API-Center → Kafka pipeline is reachable.\n');
}

run().catch((err) => {
  console.error('\n❌  FAILED:', err?.response?.data ?? err?.message ?? err);
  process.exit(1);
});
