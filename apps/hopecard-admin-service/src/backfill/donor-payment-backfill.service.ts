import { Injectable, Logger } from '@nestjs/common';
import { TribeClient } from '@implementsprint/sdk';
import { supabaseRequest } from '@app/common/supabase-helpers';

interface TableConfig {
  table: string;
  topic: string;
  eventType: string;
  select: string;
  orderBy: string;
}

export interface BackfillResult {
  table: string;
  published: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

const PAGE_SIZE = 100;

const TABLES: TableConfig[] = [
  {
    table: 'activity_logs',
    topic: 'hopecard.activity-logs',
    eventType: 'hopecard.backfill.activity_log',
    select: '*',
    orderBy: 'created_at.asc',
  },
  {
    table: 'beneficiaries',
    topic: 'hopecard.beneficiaries',
    eventType: 'hopecard.backfill.beneficiary',
    select: '*',
    orderBy: 'id.asc',
  },
  {
    table: 'beneficiary_profiles',
    topic: 'hopecard.beneficiary-profiles',
    eventType: 'hopecard.backfill.beneficiary_profile',
    select: '*',
    orderBy: 'created_at.asc',
  },
  {
    table: 'beneficiary_transactions',
    topic: 'hopecard.beneficiary-transactions',
    eventType: 'hopecard.backfill.beneficiary_transaction',
    select: '*',
    orderBy: 'created_at.asc',
  },
  {
    table: 'beneficiary_withdrawals',
    topic: 'hopecard.beneficiary-withdrawals',
    eventType: 'hopecard.backfill.beneficiary_withdrawal',
    select: '*',
    orderBy: 'created_at.asc',
  },
  {
    table: 'campaign_manager_profiles',
    topic: 'hopecard.campaign-manager-profiles',
    eventType: 'hopecard.backfill.campaign_manager_profile',
    select: '*',
    orderBy: 'created_at.asc',
  },
  {
    table: 'cart_items',
    topic: 'hopecard.cart-items',
    eventType: 'hopecard.backfill.cart_item',
    select: '*',
    orderBy: 'id.asc',
  },
  {
    table: 'carts',
    topic: 'hopecard.carts',
    eventType: 'hopecard.backfill.cart',
    select: '*',
    orderBy: 'id.asc',
  },
  {
    table: 'digital_donor_profiles',
    topic: 'hopecard.digital-donor-profiles',
    eventType: 'hopecard.backfill.digital_donor_profile',
    select: '*',
    orderBy: 'created_at.asc',
  },
  {
    table: 'hc_campaigns',
    topic: 'hopecard.campaigns',
    eventType: 'hopecard.backfill.campaign',
    select: '*',
    orderBy: 'created_at.asc',
  },
  {
    table: 'hopecard_purchases',
    topic: 'hopecard.purchases',
    eventType: 'hopecard.backfill.purchase',
    select: '*',
    orderBy: 'purchased_at.asc',
  },
  {
    table: 'hopecard_redemptions',
    topic: 'hopecard.redemptions',
    eventType: 'hopecard.backfill.redemption',
    select: '*',
    orderBy: 'created_at.asc',
  },
  {
    table: 'hopecards',
    topic: 'hopecard.hopecards',
    eventType: 'hopecard.backfill.hopecard',
    select: '*',
    orderBy: 'id.asc',
  },
];

@Injectable()
export class DonorPaymentBackfillService {
  private readonly logger = new Logger(DonorPaymentBackfillService.name);

  private getSdkClient() {
    return new TribeClient({
      gatewayUrl: process.env['APICENTER_URL']!,
      tribeId: process.env['APICENTER_TRIBE_ID']!,
      secret: process.env['APICENTER_TRIBE_SECRET']!,
    });
  }

  async run(dryRun = false): Promise<BackfillResult[]> {
    const client = this.getSdkClient();
    const tribeId = process.env['APICENTER_TRIBE_ID']!;
    const results: BackfillResult[] = [];

    for (const config of TABLES) {
      const result = await this.backfillTable(client, tribeId, config, dryRun);
      results.push(result);
    }

    return results;
  }

  private async backfillTable(
    client: TribeClient,
    tribeId: string,
    config: TableConfig,
    dryRun: boolean,
  ): Promise<BackfillResult> {
    const result: BackfillResult = { table: config.table, published: 0, failed: 0, errors: [] };
    const topic = TribeClient.buildTenantTopic(tribeId, config.topic);
    let offset = 0;

    this.logger.log(`Backfilling ${config.table} → ${topic} (dryRun=${dryRun})`);

    while (true) {
      const rows = await supabaseRequest<Record<string, unknown>[]>(
        `${config.table}?select=${config.select}&order=${config.orderBy}&limit=${PAGE_SIZE}&offset=${offset}`,
      ).catch((err) => {
        this.logger.error(`Failed to fetch ${config.table} at offset ${offset}: ${err.message}`);
        return [] as Record<string, unknown>[];
      });

      if (!rows.length) break;

      for (const row of rows) {
        const rowId = String(row['id'] ?? offset);

        if (dryRun) {
          this.logger.log(`[dry-run] Would publish ${config.table} row ${rowId} → ${topic}`);
          result.published++;
          continue;
        }

        try {
          await client.kafkaPublish({
            topic,
            key: rowId,
            eventType: config.eventType,
            payload: row,
            metadata: { system: 'hopecard', sourceTable: config.table },
            sourceServiceId: 'hopecard-admin-service',
          });
          result.published++;
        } catch (err: any) {
          result.failed++;
          result.errors.push({ id: rowId, error: err?.message ?? 'unknown' });
          this.logger.warn(`Failed to publish ${config.table} row ${rowId}: ${err?.message}`);
        }
      }

      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    this.logger.log(`${config.table} done — published: ${result.published}, failed: ${result.failed}`);
    return result;
  }
}
