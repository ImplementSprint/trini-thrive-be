import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class VolunteerRolesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db(): SupabaseClient {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  async findAll(campaignId?: string, status?: string) {
    let query = this.db.from('volunteer_roles').select('*').order('start_date', { ascending: true });
    if (campaignId) query = query.eq('campaign_id', campaignId);
    if (status) query = query.eq('status', status);

    const { data: roles, error } = await query;
    if (error) throw new BadRequestException(error.message);
    const items = roles ?? [];
    if (items.length === 0) return [];

    const campaignIds = [...new Set(items.map((r) => r.campaign_id).filter(Boolean))];
    const roleIds = items.map((r) => r.id);

    const [campaignsRes, applicationsRes] = await Promise.all([
      campaignIds.length ? this.db.from('bh_campaigns').select('id, title, type, status').in('id', campaignIds) : Promise.resolve({ data: [] as any[], error: null }),
      this.db.from('volunteer_applications').select('id, role_id, status').in('role_id', roleIds),
    ]);

    if (campaignsRes.error) throw new BadRequestException(campaignsRes.error.message);
    if (applicationsRes.error) throw new BadRequestException(applicationsRes.error.message);

    const campaignMap = new Map((campaignsRes.data ?? []).map((c) => [c.id, c]));
    const appsByRole: Record<string, any[]> = {};
    for (const a of applicationsRes.data ?? []) {
      if (!appsByRole[a.role_id]) appsByRole[a.role_id] = [];
      appsByRole[a.role_id]?.push(a);
    }

    return items.map((r) => ({ ...r, bh_campaigns: campaignMap.get(r.campaign_id) ?? null, volunteer_applications: appsByRole[r.id] ?? [] }));
  }

  async findOne(id: string) {
    const { data: role, error } = await this.db.from('volunteer_roles').select('*').eq('id', id).single();
    if (error || !role) throw new NotFoundException(`Volunteer role ${id} not found`);

    const [campaignRes, applicationsRes] = await Promise.all([
      (role as any).campaign_id
        ? this.db.from('bh_campaigns').select('id, title, type, status, org_id').eq('id', (role as any).campaign_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      this.db.from('volunteer_applications').select('id, role_id, status, applied_at, volunteer_auth_id').eq('role_id', id),
    ]);

    const apps = applicationsRes.data ?? [];
    const authIds = [...new Set(apps.map((a) => a.volunteer_auth_id).filter(Boolean))];
    let profileMap = new Map<string, any>();
    if (authIds.length) {
      const { data: profiles } = await this.db.from('user_profiles').select('id, auth_user_id, first_name, last_name, profile_photo_key').in('auth_user_id', authIds);
      profileMap = new Map((profiles ?? []).map((p) => [p.auth_user_id, p]));
    }

    return {
      ...role,
      bh_campaigns: campaignRes.data ?? null,
      volunteer_applications: apps.map((a) => ({ ...a, user_profiles: profileMap.get(a.volunteer_auth_id) ?? null })),
    };
  }
}
