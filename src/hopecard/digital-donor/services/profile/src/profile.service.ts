import { Injectable, HttpException } from '@nestjs/common';
import { supabaseRequest } from '@shared/supabase';
import { getStorageUrl } from '@shared/storage';
import { DbProfile } from '@shared/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DbImpactProfile {
  total_donations_amount: number;
  total_donations_count: number;
  first_name: string;
}

interface DbImpactPurchase {
  id: string;
  amount_paid: number;
  payment_method: string;
  status: string;
  purchased_at: string;
  hopecards: { hc_campaigns: { title: string } | null } | null;
}

@Injectable()
export class ProfileService {
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
    return { success: true };
  }

  async getImpact(authUserId: string) {
    if (!authUserId || !UUID_RE.test(authUserId)) throw new HttpException('Invalid authUserId', 400);

    const [profiles, purchases] = await Promise.all([
      supabaseRequest<DbImpactProfile[]>(
        `digital_donor_profiles?auth_user_id=eq.${authUserId}&select=total_donations_amount,total_donations_count,first_name&limit=1`
      ),
      supabaseRequest<DbImpactPurchase[]>(
        `hopecard_purchases?buyer_auth_id=eq.${authUserId}&select=id,amount_paid,payment_method,status,purchased_at,hopecards(hc_campaigns(title))&order=purchased_at.desc&limit=20`
      ),
    ]);

    const profile = profiles[0] ?? { total_donations_amount: 0, total_donations_count: 0, first_name: 'Donor' };
    const totalAmount = Number(profile.total_donations_amount);

    const donationHistory = purchases.map((p) => ({
      id: p.id,
      campaign_title: p.hopecards?.hc_campaigns?.title ?? 'Donation',
      amount_paid: Number(p.amount_paid),
      payment_method: p.payment_method,
      status: p.status,
      purchased_at: p.purchased_at,
    }));

    return {
      first_name: profile.first_name,
      stats: {
        total_donations_amount: totalAmount,
        total_donations_count: Number(profile.total_donations_count),
        lives_touched: Math.floor(totalAmount / 500),
      },
      donation_history: donationHistory,
    };
  }
}
