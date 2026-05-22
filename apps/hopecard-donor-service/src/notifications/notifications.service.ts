import { Injectable } from '@nestjs/common';
import { supabaseRequest } from '@app/common/supabase-helpers';

export interface DbNotification {
  id: string;
  donor_auth_id: string;
  type: 'new_campaign' | 'donation_success';
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

@Injectable()
export class NotificationsService {
  async getNotifications(donorAuthId: string) {
    const rows = await supabaseRequest<DbNotification[]>(
      `hc_donor_notifications?donor_auth_id=eq.${encodeURIComponent(donorAuthId)}&order=created_at.desc&limit=30`,
    );
    return { notifications: rows };
  }

  async markRead(id: string) {
    await supabaseRequest(
      `hc_donor_notifications?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ is_read: true }),
      },
    );
    return { success: true };
  }

  async markAllRead(donorAuthId: string) {
    await supabaseRequest(
      `hc_donor_notifications?donor_auth_id=eq.${encodeURIComponent(donorAuthId)}&is_read=eq.false`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ is_read: true }),
      },
    );
    return { success: true };
  }

  async createNotification(
    donorAuthId: string,
    type: DbNotification['type'],
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    await supabaseRequest('hc_donor_notifications', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        donor_auth_id: donorAuthId,
        type,
        title,
        message,
        metadata: metadata ?? null,
        is_read: false,
        created_at: new Date().toISOString(),
      }),
    });
  }

  async broadcastNewCampaign(campaignId: string, campaignTitle: string) {
    const donors = await supabaseRequest<{ auth_user_id: string }[]>(
      'digital_donor_profiles?select=auth_user_id',
    ).catch(() => [] as { auth_user_id: string }[]);

    if (!donors.length) return;

    const rows = donors.map((d) => ({
      donor_auth_id: d.auth_user_id,
      type: 'new_campaign',
      title: 'New Campaign Available',
      message: `"${campaignTitle}" has just launched. Be the first to support it!`,
      metadata: { campaign_id: campaignId },
      is_read: false,
      created_at: new Date().toISOString(),
    }));

    await supabaseRequest('hc_donor_notifications', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(rows),
    });
  }
}
