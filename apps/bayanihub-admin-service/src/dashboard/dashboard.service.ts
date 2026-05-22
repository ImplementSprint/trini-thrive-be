import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';

@Injectable()
export class DashboardService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  async getStats() {
    const [donorsRes, volunteersRes, campaignsRes, lastDonorRes, lastVolunteerRes, lastInventoryRes] = await Promise.all([
      this.db.from('donations').select('*', { count: 'exact', head: true }),
      this.db.from('volunteer_applications').select('*', { count: 'exact', head: true }),
      this.db.from('bh_campaigns').select('*', { count: 'exact', head: true }),
      this.db.from('donations').select('donated_at').order('donated_at', { ascending: false }).limit(1),
      this.db.from('volunteer_applications').select('applied_at').order('applied_at', { ascending: false }).limit(1),
      this.db.from('bh_campaigns').select('created_at').order('created_at', { ascending: false }).limit(1),
    ]);

    return {
      activeDonors: donorsRes.count ?? 0,
      volunteers: volunteersRes.count ?? 0,
      inventoryItems: campaignsRes.count ?? 0,
      lastUpdated: {
        donors: lastDonorRes.data?.[0]?.donated_at ?? null,
        volunteers: lastVolunteerRes.data?.[0]?.applied_at ?? null,
        inventory: lastInventoryRes.data?.[0]?.created_at ?? null,
      },
    };
  }

  async getRecentActivity() {
    const [donationsRes, applicationsRes, campaignsRes] = await Promise.all([
      this.db.from('donations').select('id, amount, currency, donated_at, donor_auth_id').order('donated_at', { ascending: false }).limit(5),
      this.db.from('volunteer_applications').select('id, status, applied_at, volunteer_auth_id, role_id').order('applied_at', { ascending: false }).limit(5),
      this.db.from('bh_campaigns').select('id, title, status, created_at').order('created_at', { ascending: false }).limit(5),
    ]);

    const donations = donationsRes.data ?? [];
    const applications = applicationsRes.data ?? [];

    const donorIds = [...new Set(donations.map((d) => d.donor_auth_id).filter(Boolean))];
    const volunteerIds = [...new Set(applications.map((a) => a.volunteer_auth_id).filter(Boolean))];
    const roleIds = [...new Set(applications.map((a) => a.role_id).filter(Boolean))];

    const [donorProfilesRes, volunteerProfilesRes, rolesRes] = await Promise.all([
      donorIds.length ? this.db.from('user_profiles').select('auth_user_id, first_name, last_name').in('auth_user_id', donorIds) : Promise.resolve({ data: [] }),
      volunteerIds.length ? this.db.from('user_profiles').select('auth_user_id, first_name, last_name').in('auth_user_id', volunteerIds) : Promise.resolve({ data: [] }),
      roleIds.length ? this.db.from('volunteer_roles').select('id, title').in('id', roleIds) : Promise.resolve({ data: [] }),
    ]);

    const donorMap = new Map((donorProfilesRes.data ?? []).map((p: Record<string, unknown>) => [p['auth_user_id'], p]));
    const volunteerMap = new Map((volunteerProfilesRes.data ?? []).map((p: Record<string, unknown>) => [p['auth_user_id'], p]));
    const roleMap = new Map((rolesRes.data ?? []).map((r: Record<string, unknown>) => [r['id'], r]));

    const activities = [
      ...donations.map((d) => {
        const p = donorMap.get(d.donor_auth_id) as Record<string, unknown> | undefined;
        return { type: 'donation' as const, title: 'New donation received', subtitle: `${p?.['first_name'] ?? 'Anonymous'} ${p?.['last_name'] ?? ''} donated ${d.currency ?? 'PHP'} ${d.amount}`.trim(), time: d.donated_at };
      }),
      ...applications.map((a) => {
        const p = volunteerMap.get(a.volunteer_auth_id) as Record<string, unknown> | undefined;
        const r = roleMap.get(a.role_id) as Record<string, unknown> | undefined;
        return { type: 'application' as const, title: 'Volunteer application submitted', subtitle: `${p?.['first_name'] ?? 'Unknown'} ${p?.['last_name'] ?? ''} applied for ${r?.['title'] ?? 'volunteer'} role`.trim(), time: a.applied_at };
      }),
      ...(campaignsRes.data ?? []).map((c) => ({ type: 'campaign' as const, title: 'Campaign created', subtitle: `"${c.title}" is now ${c.status}`, time: c.created_at })),
    ];

    activities.sort((a, b) => new Date(b.time as string).getTime() - new Date(a.time as string).getTime());
    return activities.slice(0, 10);
  }

  async getDashboard() {
    const [stats, recentActivity] = await Promise.all([this.getStats(), this.getRecentActivity()]);
    return { stats, recentActivity };
  }
}
