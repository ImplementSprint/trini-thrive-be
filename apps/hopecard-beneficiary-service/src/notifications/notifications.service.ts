import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

type SbError = { message: string } | null;

interface ProfileRow {
  id: string;
}

interface BeneficiaryRow {
  id: string;
}

interface InvitationRow {
  id: string;
  invited_at: string;
  hc_campaigns: { title?: string } | null;
}

interface TransactionRow {
  id: string;
  amount: string;
  created_at: string;
  notes: string | null;
}

@Injectable()
export class BeneficiaryNotificationsService {
  private get admin() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  private async getProfileAndBeneficiary(authUserId: string) {
    const [{ data: profile }, { data: beneficiary }] = (await Promise.all([
      this.admin
        .from('beneficiary_profiles')
        .select('id')
        .eq('auth_user_id', authUserId)
        .maybeSingle(),
      this.admin
        .from('beneficiaries')
        .select('id')
        .eq('auth_user_id', authUserId)
        .maybeSingle(),
    ])) as [
      { data: ProfileRow | null; error: SbError },
      { data: BeneficiaryRow | null; error: SbError },
    ];
    return { profile, beneficiary };
  }

  async getNotifications(authUserId: string) {
    const { profile, beneficiary } =
      await this.getProfileAndBeneficiary(authUserId);

    const notifications: {
      id: string;
      type: 'invitation' | 'disbursement';
      title: string;
      message: string;
      created_at: string;
      is_read: boolean;
      metadata: Record<string, unknown>;
    }[] = [];

    // 1. Pending campaign invitations
    if (profile) {
      const { data: invitations } = (await this.admin
        .from('campaign_invitations')
        .select('id, invited_at, hc_campaigns(title)')
        .eq('beneficiary_profile_id', profile.id)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false })
        .limit(10)) as { data: InvitationRow[] | null; error: SbError };

      for (const inv of invitations ?? []) {
        const campaignTitle = inv.hc_campaigns?.title ?? 'a campaign';
        notifications.push({
          id: `inv-${inv.id}`,
          type: 'invitation',
          title: 'Campaign Invitation',
          message: `You have been invited to join "${campaignTitle}". Tap to respond.`,
          created_at: inv.invited_at,
          is_read: false,
          metadata: { invitation_id: inv.id },
        });
      }
    }

    // 2. Approved disbursements (admin sent funds)
    if (beneficiary) {
      const { data: transactions } = (await this.admin
        .from('beneficiary_transactions')
        .select('id, amount, created_at, notes')
        .eq('beneficiary_id', beneficiary.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10)) as { data: TransactionRow[] | null; error: SbError };

      for (const tx of transactions ?? []) {
        notifications.push({
          id: `tx-${tx.id}`,
          type: 'disbursement',
          title: 'Funds Disbursed',
          message: `₱${Number(tx.amount).toLocaleString('en-PH')} has been sent to your account${tx.notes ? `: ${tx.notes}` : '.'}`,
          created_at: tx.created_at,
          is_read: false,
          metadata: { transaction_id: tx.id, amount: tx.amount },
        });
      }
    }

    // Sort by date descending
    notifications.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return {
      notifications,
      unread_count: notifications.length,
    };
  }
}
