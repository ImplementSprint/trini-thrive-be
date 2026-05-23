import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { TribeClient } from '@implementsprint/sdk';

export type ProcedureEventType =
  // Admin approvals
  | 'hopecard.beneficiary.approved'
  | 'hopecard.beneficiary.rejected'
  | 'hopecard.beneficiary.document.approved'
  | 'hopecard.beneficiary.document.rejected'
  | 'hopecard.beneficiary.bank.approved'
  | 'hopecard.beneficiary.bank.rejected'
  | 'hopecard.beneficiary.donation.sent'
  | 'hopecard.donor.approved'
  | 'hopecard.donor.rejected'
  | 'hopecard.campaign_manager.approved'
  | 'hopecard.campaign_manager.rejected'
  // Admin beneficiary management
  | 'hopecard.beneficiary.created_by_admin'
  | 'hopecard.beneficiary.updated'
  | 'hopecard.beneficiary.deleted'
  // Campaigns
  | 'hopecard.campaign.created'
  | 'hopecard.campaign.updated'
  | 'hopecard.campaign.published'
  | 'hopecard.campaign.closed'
  // Transactions
  | 'hopecard.donation.completed'
  | 'hopecard.withdrawal.requested'
  // Registrations
  | 'hopecard.beneficiary.registered'
  | 'hopecard.donor.registered'
  | 'hopecard.campaign_manager.registered'
  // Logins
  | 'hopecard.beneficiary.login'
  | 'hopecard.donor.login'
  | 'hopecard.donor.google_registered'
  | 'hopecard.donor.google_login'
  | 'hopecard.campaign_manager.login'
  // Documents and bank accounts
  | 'hopecard.document.submitted'
  | 'hopecard.document.deleted'
  | 'hopecard.bank_account.submitted'
  | 'hopecard.bank_account.updated'
  | 'hopecard.bank_account.deleted'
  // Beneficiary campaign actions
  | 'hopecard.beneficiary.invitation_accepted'
  | 'hopecard.beneficiary.invitation_declined'
  // Donor actions
  | 'hopecard.donor.id_uploaded'
  | 'hopecard.donor.profile_updated'
  | 'hopecard.cart.item_added'
  | 'hopecard.cart.item_updated'
  | 'hopecard.cart.item_removed'
  // Backfill
  | 'hopecard.donor.payment_customer_synced';

export interface EmitOptions {
  // Kafka partition key — use the primary entity ID so events for the
  // same entity are ordered on the same partition (important for Athena queries).
  partitionKey?: string;
  sourceServiceId?: string;
}

@Injectable()
export class ProcedureEventService {
  private readonly logger = new Logger('ProcedureEventService');

  constructor(
    @Optional()
    @Inject(TribeClient)
    private readonly client: TribeClient | null,
  ) {}

  // Fire-and-forget — events must never block or throw in the caller.
  // Payload is wrapped in a consistent Athena-queryable envelope so Glue
  // can build a stable schema across all event types.
  emit(
    eventType: ProcedureEventType,
    payload: Record<string, unknown>,
    options: EmitOptions = {},
  ): void {
    if (!this.client) {
      this.logger.debug(
        `Skipping event ${eventType} — TribeClient not available`,
      );
      return;
    }

    this.client
      .publishTribeEvent({
        eventType,
        ...(options.partitionKey !== undefined && { key: options.partitionKey }),
        ...(options.sourceServiceId !== undefined && { sourceServiceId: options.sourceServiceId }),
        payload: {
          ...payload,
          occurredAt: new Date().toISOString(),
        },
        metadata: {
          system: 'hopecard',
          eventVersion: '1',
        },
      })
      .catch((err: Error) =>
        this.logger.warn(`Failed to publish ${eventType}: ${err.message}`),
      );
  }
}
