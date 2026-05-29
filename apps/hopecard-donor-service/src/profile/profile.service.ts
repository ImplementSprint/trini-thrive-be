import { Injectable, HttpException } from '@nestjs/common';
import { supabaseRequest } from '@app/common/supabase-helpers';
import { getStorageUrl } from '@app/common/storage';
import { DbProfile } from '@app/common/types';
import { getRecordId, getRecordTitle } from '@app/common/supabase-helpers';
import { ProcedureEventService } from '@app/api-center';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAID_STATUSES = new Set(['paid', 'succeeded', 'completed', 'active']);

interface DbImpactProfile {
  total_donations_amount: number;
  total_donations_count: number;
  first_name: string;
}

interface DbImpactPurchase {
  id: string;
  hopecard_id: string;
  amount_paid: number;
  payment_method: string;
  status: string;
  purchased_at: string;
}

@Injectable()
export class ProfileService {
  constructor(private readonly events: ProcedureEventService) {}

  async getProfile(authUserId: string, email?: string) {
    if (!authUserId || !UUID_RE.test(authUserId)) throw new HttpException('Invalid authUserId', 400);

    let rows = await supabaseRequest<DbProfile[]>(
      `digital_donor_profiles?auth_user_id=eq.${authUserId}&select=id,first_name,last_name,phone,address,barangay,municipality,province,profile_photo_key,status,created_at,total_donations_amount,total_donations_count&limit=1`
    );

    if (rows.length === 0 && email) {
      rows = await supabaseRequest<DbProfile[]>(
        `digital_donor_profiles?email=eq.${encodeURIComponent(email)}&select=id,first_name,last_name,phone,address,barangay,municipality,province,profile_photo_key,status,created_at,total_donations_amount,total_donations_count&limit=1`
      );
    }

    if (rows.length === 0) throw new HttpException('Profile not found', 404);

    const row = rows[0];
    if (!row) throw new HttpException('Profile not found', 404);
    return {
      profile: {
        id: row.id, first_name: row.first_name, last_name: row.last_name,
        phone: row.phone || '', address: row.address || '',
        barangay: row.barangay || '', municipality: row.municipality || '', province: row.province || '',
        profile_photo_url: getStorageUrl('profile-photos', row.profile_photo_key),
        profile_photo_key: row.profile_photo_key || '',
        status: row.status, created_at: row.created_at,
        total_donations_amount: row.total_donations_amount || 0,
        total_donations_count: row.total_donations_count || 0,
      },
    };
  }

  async updateProfile(authUserId: string, updates: Record<string, any>) {
    if (!authUserId || !UUID_RE.test(authUserId)) throw new HttpException('Invalid authUserId', 400);
    const patch: Record<string, string> = { updated_at: new Date().toISOString() };
    const fields = ['first_name', 'last_name', 'phone', 'address', 'barangay', 'municipality', 'province', 'profile_photo_key'];
    fields.forEach((f) => { if (updates[f] !== undefined) patch[f] = updates[f]; });
    await supabaseRequest(`digital_donor_profiles?auth_user_id=eq.${authUserId}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch),
    });
    this.events.emit(
      'hopecard.donor.profile_updated',
      { authUserId, fields: Object.keys(patch).filter((k) => k !== 'updated_at') },
      { partitionKey: authUserId, sourceServiceId: 'hopecard-donor-service' },
    );
    return { success: true };
  }

  async getImpact(authUserId: string) {
    if (!authUserId || !UUID_RE.test(authUserId)) throw new HttpException('Invalid authUserId', 400);

    const [profiles, purchases, hcCampaigns, hopecards] = await Promise.all([
      supabaseRequest<DbImpactProfile[]>(
        `digital_donor_profiles?auth_user_id=eq.${authUserId}&select=total_donations_amount,total_donations_count,first_name&limit=1`
      ),
      supabaseRequest<DbImpactPurchase[]>(
        `hopecard_purchases?buyer_auth_id=eq.${authUserId}&select=id,hopecard_id,amount_paid,payment_method,status,purchased_at&order=purchased_at.desc&limit=50`
      ),
      supabaseRequest<Record<string, unknown>[]>('hc_campaigns?select=id,title').catch(() => []),
      supabaseRequest<Record<string, unknown>[]>('hopecards?select=id,title,name').catch(() => []),
    ]);

    const profile = profiles[0] ?? { total_donations_amount: 0, total_donations_count: 0, first_name: 'Donor' };

    // Always compute the live accumulative total from actual purchases (paid only)
    // so the TRAIN Law credit section is always accurate, even for existing accounts
    // whose stored totals were never updated.
    const paidPurchases = purchases.filter((p) => PAID_STATUSES.has(String(p.status).toLowerCase()));
    const totalAmount = paidPurchases.reduce((sum, p) => sum + Number(p.amount_paid), 0);
    const totalCount = paidPurchases.length;

    const allCampaignRecords = [...hcCampaigns, ...hopecards];
    const titleById = new Map<string, string>();
    allCampaignRecords.forEach((r) => {
      const id = getRecordId(r);
      const title = getRecordTitle(r);
      if (id && title) titleById.set(id, title);
    });

    const distinctCampaigns = new Set(paidPurchases.map((p) => p.hopecard_id)).size;

    const donationHistory = purchases.map((p) => ({
      id: p.id,
      campaign_title: titleById.get(p.hopecard_id) ?? 'Donation',
      amount_paid: Number(p.amount_paid),
      payment_method: p.payment_method,
      status: p.status,
      purchased_at: p.purchased_at,
    }));

    return {
      first_name: profile.first_name,
      stats: {
        total_donations_amount: totalAmount,
        total_donations_count: totalCount,
        hopecards_donated: distinctCampaigns,
      },
      donation_history: donationHistory,
    };
  }
}
