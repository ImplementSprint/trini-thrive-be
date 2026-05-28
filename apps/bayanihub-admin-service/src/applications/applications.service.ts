import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';
import { ApplicationStatus, FilterApplicationsDto, ReviewApplicationDto } from './dto/applications.dto';

@Injectable()
export class ApplicationsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  async findAll(filters: FilterApplicationsDto) {
    let query = this.db
      .from('volunteer_applications')
      .select('*')
      .order('applied_at', { ascending: false });

    if (filters.role_id) query = query.eq('role_id', filters.role_id);
    if (filters.status) {
      query = query.eq('status', filters.status);
    } else {
      query = query.in('status', ['submitted', 'pending']);
    }
    if (filters.search) {
      query = query.or(`motivation.ilike.%${filters.search}%,skills.ilike.%${filters.search}%`);
    }

    const { data: applications, error } = await query;
    if (error) throw error;
    if (!applications?.length) return [];

    const roleIds = [...new Set(applications.map((a) => a.role_id).filter(Boolean))];
    const volunteerIds = [...new Set(applications.map((a) => a.volunteer_auth_id).filter(Boolean))];

    const [rolesRes, profilesRes, usersRes] = await Promise.all([
      roleIds.length
        ? this.db.from('volunteer_roles').select('id, title, campaign_id').in('id', roleIds)
        : Promise.resolve({ data: [] }),
      volunteerIds.length
        ? this.db.from('user_profiles').select('auth_user_id, first_name, last_name, phone, profile_photo_key, role').in('auth_user_id', volunteerIds)
        : Promise.resolve({ data: [] }),
      this.db.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const roleMap = new Map((rolesRes.data ?? []).map((r: Record<string, unknown>) => [r['id'], r]));
    const userMap = new Map((usersRes.data?.users ?? []).map((u) => [u.id, u]));
    const profileMap = new Map();
    (profilesRes.data ?? []).forEach((p: Record<string, unknown>) => {
      const authUser = userMap.get(p['auth_user_id'] as string);
      profileMap.set(p['auth_user_id'], { ...p, email: authUser?.email ?? null });
    });

    return applications.map((a) => ({
      ...a,
      volunteer_roles: roleMap.get(a.role_id) ?? null,
      user_profiles: profileMap.get(a.volunteer_auth_id) ?? null,
    }));
  }

  async findOne(id: string) {
    const { data: application, error } = await this.db
      .from('volunteer_applications')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!application) throw new NotFoundException('Application not found');

    const [roleRes, profileRes] = await Promise.all([
      application.role_id
        ? this.db.from('volunteer_roles').select('*').eq('id', application.role_id).single()
        : Promise.resolve({ data: null }),
      application.volunteer_auth_id
        ? this.db.from('user_profiles').select('*').eq('auth_user_id', application.volunteer_auth_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return { ...application, volunteer_roles: roleRes.data, user_profiles: profileRes.data };
  }

  async review(applicationId: string, dto: ReviewApplicationDto, reviewerUserId: string | null) {
    const { data: application, error: fetchErr } = await this.db
      .from('volunteer_applications')
      .select('id, volunteer_auth_id, status')
      .eq('id', applicationId)
      .single();

    if (fetchErr || !application) throw new NotFoundException('Application not found');

    const updatePayload: Record<string, unknown> = { reviewed_by: reviewerUserId };
    if (dto.status) updatePayload['status'] = dto.status;
    if (dto.internal_notes !== undefined) updatePayload['internal_notes'] = dto.internal_notes;

    const { data: updated, error: updateErr } = await this.db
      .from('volunteer_applications')
      .update(updatePayload)
      .eq('id', applicationId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    if (dto.status === ApplicationStatus.APPROVED) {
      await this.db.from('user_profiles').update({ role: 'volunteer' }).eq('auth_user_id', application.volunteer_auth_id);
    }

    try {
      await this.db.from('bh_notifications').insert({
        user_id: application.volunteer_auth_id,
        target_role: 'volunteer',
        title: `Volunteer Application ${dto.status === ApplicationStatus.APPROVED ? 'Approved' : 'Rejected'}`,
        message: `Your volunteer application has been ${dto.status} by the administrator.`,
        type: 'volunteer_application_review',
        reference_id: applicationId,
      });
    } catch (e) {}

    return updated;
  }

  async getRoles(campaignId?: string) {
    let query = this.db.from('volunteer_roles').select('*').eq('status', 'active');
    if (campaignId) query = query.eq('campaign_id', campaignId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
}
