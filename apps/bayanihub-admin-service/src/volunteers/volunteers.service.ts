import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';
import { FilterVolunteerRolesDto } from './dto/volunteers.dto';

@Injectable()
export class VolunteersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  async findRoles(filters: FilterVolunteerRolesDto) {
    let query = this.db.from('volunteer_roles').select('*').order('start_date', { ascending: false });
    if (filters.campaign_id) query = query.eq('campaign_id', filters.campaign_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);

    const { data: roles, error } = await query;
    if (error) throw error;
    if (!roles?.length) return [];

    const campaignIds = [...new Set(roles.map((r) => r.campaign_id).filter(Boolean))];
    const campaignsRes = campaignIds.length ? await this.db.from('bh_campaigns').select('id, title, type, status').in('id', campaignIds) : { data: [] };
    const campaignMap = new Map((campaignsRes.data ?? []).map((c: Record<string, unknown>) => [c['id'], c]));

    return roles.map((r) => ({ ...r, bh_campaigns: campaignMap.get(r.campaign_id) ?? null }));
  }

  async findRole(id: string) {
    const { data: role, error } = await this.db.from('volunteer_roles').select('*').eq('id', id).single();
    if (error) throw error;
    if (!role) throw new NotFoundException('Volunteer role not found');

    let campaign = null;
    if (role.campaign_id) {
      const { data } = await this.db.from('bh_campaigns').select('id, title, type, start_date, end_date, status').eq('id', role.campaign_id).single();
      campaign = data;
    }

    return { ...role, bh_campaigns: campaign };
  }

  async verifyVolunteer(authUserId: string) {
    const { data: profile, error } = await this.db.from('user_profiles').select('*').eq('auth_user_id', authUserId).single();
    if (error || !profile) return { is_volunteer: false, profile: null };
    return { is_volunteer: profile.role === 'volunteer', profile };
  }

  async searchVolunteers(search: string) {
    if (!search?.trim()) return [];
    const { data, error } = await this.db.from('user_profiles').select('*').or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    if (error) throw error;
    return data;
  }

  async getDeployments(applicationId: string) {
    const { data, error } = await this.db.from('volunteer_deployments').select('*').eq('application_id', applicationId).order('date_assigned', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getStats() {
    const [totalRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
      this.db.from('volunteer_applications').select('*', { count: 'exact', head: true }),
      this.db.from('volunteer_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      this.db.from('volunteer_applications').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      this.db.from('volunteer_applications').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    ]);
    return { total: totalRes.count ?? 0, pending: pendingRes.count ?? 0, approved: approvedRes.count ?? 0, rejected: rejectedRes.count ?? 0 };
  }
}
