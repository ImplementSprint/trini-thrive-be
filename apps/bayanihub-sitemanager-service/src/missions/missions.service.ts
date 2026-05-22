import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

export interface ActivateMissionDto {
  campaign_id: string;
  role_id: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  notes?: string;
}

@Injectable()
export class MissionsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db(): SupabaseClient {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  private normalizeVolunteerRoleTitle(title: string | null | undefined) {
    const normalized = String(title ?? '').trim().toLowerCase();
    if (!normalized) return 'Unassigned';
    if (normalized.includes('medic') || normalized.includes('medical') || normalized.includes('health')) return 'Medic';
    if (normalized.includes('logistic') || normalized.includes('supply') || normalized.includes('packer')) return 'Logistics';
    if (['field', 'ops', 'community', 'construction', 'rescue'].some((k) => normalized.includes(k))) return 'Field';
    return title?.trim() || 'Unassigned';
  }

  async activateMission(dto: ActivateMissionDto, activatedBy: string) {
    const { data: applications, error: appError } = await this.db
      .from('volunteer_applications')
      .select('id, volunteer_auth_id')
      .eq('role_id', dto.role_id)
      .eq('status', 'approved');

    if (appError) throw new BadRequestException(appError.message);
    if (!applications || applications.length === 0) return { success: true, deployments_created: 0, message: 'No approved volunteers for this role yet.' };

    const deploymentRecords = applications.map((app) => ({
      application_id: app.id,
      damayan_operation_id: dto.campaign_id,
      task_description: dto.notes ?? 'Mission activated by site manager',
      date_assigned: new Date().toISOString(),
      status: 'active',
    }));

    const { data, error } = await this.db.from('volunteer_deployments').insert(deploymentRecords).select();
    if (error) throw new BadRequestException(error.message);
    return { success: true, deployments_created: data?.length ?? 0, deployments: data };
  }

  async assignVolunteers(applicationIds: string[], campaignId: string, notes?: string) {
    if (!applicationIds?.length) throw new BadRequestException('No volunteers selected.');

    const { data: existingDeployments, error: existingError } = await this.db
      .from('volunteer_deployments')
      .select('id, application_id, damayan_operation_id, status, date_assigned')
      .in('application_id', applicationIds)
      .eq('damayan_operation_id', campaignId)
      .in('status', ['active', 'assigned']);

    if (existingError) throw new BadRequestException(existingError.message);

    const existingApplicationIds = new Set((existingDeployments ?? []).map((d) => d.application_id));
    const missingApplicationIds = applicationIds.filter((id) => !existingApplicationIds.has(id));

    const deploymentRecords = missingApplicationIds.map((appId) => ({
      application_id: appId,
      damayan_operation_id: campaignId,
      task_description: notes ?? 'Assigned by Site Manager',
      date_assigned: new Date().toISOString(),
      status: 'active',
    }));

    const insertResult = deploymentRecords.length
      ? await this.db.from('volunteer_deployments').insert(deploymentRecords).select()
      : { data: [] as any[], error: null };

    if (insertResult.error) throw new BadRequestException(insertResult.error.message);
    const deployments = [...(existingDeployments ?? []), ...(insertResult.data ?? [])];
    return { success: true, assigned: deployments.length, message: `${deployments.length} volunteer(s) assigned to mission.` };
  }

  async getVolunteerSummary(campaignId?: string) {
    let roleIdFilter: string[] | null = null;
    if (campaignId) {
      const { data: roles } = await this.db.from('volunteer_roles').select('id').eq('campaign_id', campaignId);
      roleIdFilter = (roles ?? []).map((r) => r.id);
      if (roleIdFilter.length === 0) return { summary: { total: 0, active: 0, on_mission: 0, completed: 0 }, by_role: {}, deployments: [] };
    }

    let appQuery = this.db.from('volunteer_applications').select('*').eq('status', 'approved').order('applied_at', { ascending: false });
    if (roleIdFilter) appQuery = appQuery.in('role_id', roleIdFilter);

    const { data: applications, error: appErr } = await appQuery;
    if (appErr) throw new BadRequestException(appErr.message);
    const apps = applications ?? [];
    if (apps.length === 0) return { summary: { total: 0, active: 0, on_mission: 0, completed: 0 }, by_role: {}, deployments: [] };

    const appIds = apps.map((a) => a.id);
    const { data: deployments } = await this.db.from('volunteer_deployments').select('id, application_id, damayan_operation_id, status, date_assigned').in('application_id', appIds);

    const STATUS_PRIORITY: Record<string, number> = { active: 3, assigned: 2, completed: 1 };
    const deployedMap = new Map<string, { status: string; date_assigned: string | null; deployment_id: string | null; damayan_operation_id: string | null }>();
    for (const d of deployments ?? []) {
      if (campaignId && d.damayan_operation_id !== campaignId) continue;
      const existing = deployedMap.get(d.application_id);
      const newPriority = STATUS_PRIORITY[d.status] ?? 0;
      const oldPriority = existing ? (STATUS_PRIORITY[existing.status] ?? 0) : -1;
      if (newPriority > oldPriority) deployedMap.set(d.application_id, { status: d.status, date_assigned: d.date_assigned ?? null, deployment_id: d.id ?? null, damayan_operation_id: d.damayan_operation_id ?? null });
    }

    const authIds = [...new Set(apps.map((a) => a.volunteer_auth_id).filter(Boolean))];
    const roleIds = [...new Set(apps.map((a) => a.role_id).filter(Boolean))];
    const deploymentIds = [...new Set(Array.from(deployedMap.values()).map((v) => v.deployment_id).filter(Boolean))];

    const [profilesRes, rolesRes, tasksRes] = await Promise.all([
      authIds.length ? this.db.from('user_profiles').select('id, auth_user_id, first_name, last_name, profile_photo_key, barangay, municipality').in('auth_user_id', authIds).eq('role', 'volunteer') : Promise.resolve({ data: [] as any[], error: null }),
      roleIds.length ? this.db.from('volunteer_roles').select('id, campaign_id, title, location, tasks').in('id', roleIds) : Promise.resolve({ data: [] as any[], error: null }),
      deploymentIds.length ? this.db.from('volunteer_task_assignments').select('deployment_id, task_title, status').in('deployment_id', deploymentIds as string[]) : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.auth_user_id, p]));
    const taskMap = new Map<string, any[]>();
    for (const t of tasksRes.data ?? []) {
      if (!taskMap.has(t.deployment_id)) taskMap.set(t.deployment_id, []);
      taskMap.get(t.deployment_id)!.push(t);
    }

    const volunteerAuthIds = new Set(profileMap.keys());
    const volunteerApps = apps.filter((a) => volunteerAuthIds.has(a.volunteer_auth_id));
    const roleMap = new Map((rolesRes.data ?? []).map((r) => [r.id, r]));

    let active = 0, on_mission = 0, completed = 0;
    const byRole: Record<string, number> = {};

    const enriched = volunteerApps.map((app) => {
      const deployment = deployedMap.get(app.id);
      const deployStatus = deployment?.status;
      const status = deployStatus === 'active' ? 'active' : deployStatus === 'assigned' ? 'assigned' : deployStatus === 'completed' ? 'completed' : 'standby';
      if (status === 'active') active++;
      if (status === 'assigned') on_mission++;
      if (status === 'completed') completed++;

      const role = roleMap.get(app.role_id) as any;
      const roleTitle = this.normalizeVolunteerRoleTitle(role?.title);
      byRole[roleTitle] = (byRole[roleTitle] ?? 0) + 1;
      const normalizedRole = role ? { ...role, title: roleTitle, original_title: role.title ?? null } : null;

      return {
        id: app.id, status, application_id: app.id,
        date_assigned: deployment?.date_assigned ?? app.applied_at ?? null,
        task_description: roleTitle ?? 'Assigned',
        damayan_operation_id: deployment?.damayan_operation_id ?? role?.campaign_id ?? null,
        deployment_id: deployment?.deployment_id ?? null,
        current_tasks: deployment?.deployment_id ? (taskMap.get(deployment.deployment_id) ?? []) : [],
        volunteer_applications: { ...app, user_profiles: profileMap.get(app.volunteer_auth_id) ?? null, volunteer_roles: normalizedRole },
      };
    });

    return { summary: { total: volunteerApps.length, active, on_mission, completed }, by_role: byRole, deployments: enriched };
  }

  async getFinalReport(campaignId?: string) {
    const client = this.db;
    let donQuery = client.from('donations').select('quantity, status').eq('status', 'completed');
    if (campaignId) donQuery = donQuery.eq('campaign_id', campaignId);
    const { data: donations } = await donQuery;
    const totalReconciledGoods = (donations ?? []).reduce((acc, curr) => acc + Number(curr.quantity ?? 0), 0);

    let shiftsQuery = client.from('volunteer_shifts').select('total_hours').eq('status', 'approved');
    if (campaignId) shiftsQuery = shiftsQuery.eq('campaign_id', campaignId);
    const { data: shifts } = await shiftsQuery;
    const totalManHours = (shifts ?? []).reduce((acc, curr) => acc + Number(curr.total_hours ?? 0), 0);

    const { data: deploymentRows } = await client.from('volunteer_deployments').select('status');
    const completedDeployments = (deploymentRows ?? []).filter((d) => d.status === 'completed').length;
    const totalDeployments = (deploymentRows ?? []).length;
    const successRate = totalDeployments > 0 ? (completedDeployments / totalDeployments) * 100 : 0;

    return {
      mission_summary: {
        total_donations_reconciled: totalReconciledGoods,
        total_volunteer_man_hours: Number(totalManHours.toFixed(2)),
        mission_success_rate_percent: Number(successRate.toFixed(2)),
        total_volunteers_participated: totalDeployments,
      },
      archived_data_points: { completed_shifts: shifts?.length ?? 0, reconciled_dropoffs: donations?.length ?? 0 },
    };
  }
}
