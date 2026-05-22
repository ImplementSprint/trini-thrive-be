import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

type MissionTaskStatus = 'in_progress' | 'completed' | undefined;

type MissionContext = {
  applications: any[];
  deployment: any | null;
  role: any | null;
  application: any | null;
  campaign: any | null;
  zone: any | null;
  shift: any | null;
  shifts: any[];
  deployments: any[];
};

const ACTIVE_SHIFT_STATUSES = ['pending', 'flagged'];

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get db(): SupabaseClient {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  async getActiveCampaigns() {
    const { data: result, error } = await this.db
      .from('bh_campaigns')
      .select('*')
      .eq('status', 'active')
      .eq('type', 'donation')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`BayaniHub Campaign Error: ${error.message}`);
    const openCampaigns = (result ?? []).filter((c: any) => !this.isCampaignClosed(c));
    return Promise.all(openCampaigns.map((c: any) => this.enrichCampaignForEnduser(c, 'donation')));
  }

  async getVolunteerCampaigns() {
    const { data: result, error } = await this.db
      .from('bh_campaigns')
      .select('*')
      .eq('status', 'active')
      .eq('type', 'volunteer')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`BayaniHub Campaign Error: ${error.message}`);
    const openCampaigns = (result ?? []).filter((c: any) => !this.isCampaignClosed(c));
    return Promise.all(openCampaigns.map((c: any) => this.enrichCampaignForEnduser(c, 'volunteer')));
  }

  async insertVolunteerApplication(data: any, volunteerAuthId: string, file?: Express.Multer.File) {
    const { role, center_id, campaign_id, center_name } = data;
    const isUUID = (str: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const validCampaignId = isUUID(center_id) ? center_id : isUUID(campaign_id) ? campaign_id : null;
    const displayName = center_name || (validCampaignId ? 'In-Progress Selection' : 'N/A');

    if (!validCampaignId && !center_name) throw new Error('Missing site location or campaign identifier.');
    if (!role) throw new Error('Missing selected role in application payload.');

    if (validCampaignId) await this.assertCampaignCanAccept(validCampaignId, 'volunteer');

    let query = this.db.from('volunteer_roles').select('id').ilike('title', role);
    if (validCampaignId) query = query.eq('campaign_id', validCampaignId);
    let { data: roles } = await query.limit(1);

    let roleId: string;
    if (!roles || roles.length === 0) {
      const { data: newRole, error: roleErr } = await this.db
        .from('volunteer_roles')
        .insert([{ title: role, campaign_id: validCampaignId, status: 'open', slots_total: 10 }])
        .select('id')
        .single();
      if (roleErr) throw new Error(`Role Creation Error: ${roleErr.message}`);
      roleId = newRole.id;
    } else {
      roleId = roles[0].id;
    }

    if (validCampaignId) {
      await this.assertVolunteerHasNotApprovedForRole(volunteerAuthId, roleId);
      await this.assertVolunteerRoleCanAccept(roleId);
    }

    let resumeKey: string | null = null;
    if (file) resumeKey = await this.uploadFile(file, 'resumes');

    const emergencyContactName = String(data.emergency_contact_name ?? '').trim();
    const emergencyContactNumber = String(data.emergency_contact_number ?? '').replace(/\D/g, '');
    const emergencyContact =
      emergencyContactName && emergencyContactNumber
        ? `${emergencyContactName} - ${emergencyContactNumber}`
        : data.emergency_contact || 'Not provided';

    const motivationStr = `Questionnaire Assessment:
- Site/Campaign: ${displayName} (${validCampaignId || 'No UUID Mapping'})
- Emergency Contact: ${emergencyContact}
- Disaster Experience: ${data.disaster_experience === 'true' || data.disaster_experience === true ? 'Yes' : 'No'}
- Rugged Environment Comfort: ${data.rugged_environment === 'true' || data.rugged_environment === true ? 'Yes' : 'No'}
- Medical Conditions/Restrictions: ${data.medical_conditions === 'true' || data.medical_conditions === true ? 'Yes' : 'No'}
- Can Lift 25lbs: ${data.can_lift_25lbs === 'true' || data.can_lift_25lbs === true ? 'Yes' : 'No'}
- Transportation: ${data.has_transportation === 'true' || data.has_transportation === true ? 'Yes' : 'No'} (${data.transportation_mode || 'N/A'})
- Background Check Agreed: ${data.background_check_agreed === 'true' || data.background_check_agreed === true ? 'Yes' : 'No'}
- Over 18: ${data.age_verified === 'true' || data.age_verified === true ? 'Yes' : 'No'}
- Code of Conduct / Safety Agreed: Yes`;

    const applicationPayload = {
      role_id: roleId,
      volunteer_auth_id: volunteerAuthId,
      motivation: motivationStr,
      skills: [role || 'Volunteer'],
      availability: data.time_slot,
      resume_key: resumeKey,
      status: 'submitted',
    };

    const { data: result, error } = await this.db
      .from('volunteer_applications')
      .insert([applicationPayload])
      .select();

    if (error) {
      this.logger.error(`Volunteer application insert failed: ${error.message}`);
      throw new Error(`Supabase Error: ${error.message}`);
    }

    if (result && result.length > 0) {
      const appId = result[0].id;
      try {
        await this.db.from('bh_notifications').insert([
          {
            target_role: 'admin',
            title: 'New Volunteer Application',
            message: 'A new volunteer application has been submitted and is pending review.',
            type: 'volunteer_application',
            reference_id: appId,
          },
          {
            target_role: 'siteman',
            title: 'New Volunteer Application',
            message: 'A new volunteer application has been submitted and is pending review.',
            type: 'volunteer_application',
            reference_id: appId,
          },
        ]);
      } catch (err: any) {
        this.logger.error(`Failed to insert notification: ${err.message}`);
      }
    }

    if (validCampaignId) await this.closeCampaignIfLimitReached(validCampaignId, 'volunteer');
    return result;
  }

  async insertDonation(donationData: any, donorAuthId: string) {
    const { campaign_id, center_id, center_name, items } = donationData;
    const finalCampaignId = campaign_id || center_id || center_name;

    if (!items || !Array.isArray(items)) throw new Error('Invalid donation payload. Missing items array.');
    await this.assertCampaignCanAccept(finalCampaignId, 'donation');

    const rows = items.map((item: any) => ({
      campaign_id: finalCampaignId,
      donor_auth_id: donorAuthId,
      status: 'pending',
      item_name: item.name,
      quantity: parseInt(item.qty || item.quantity, 10) || 1,
      unit: (item.unit || 'pieces').toLowerCase(),
      condition: (item.condition || 'good').toLowerCase().replace(/\s+|-/g, '_'),
      message: donationData.message || donationData.donor_message || null,
    }));

    const { data: result, error } = await this.db.from('donations').insert(rows).select();
    if (error) throw new Error(`Supabase Error: ${error.message}`);

    if (result && result.length > 0) {
      try {
        await this.db.from('bh_notifications').insert([
          {
            target_role: 'admin',
            title: 'New Donation Pledge',
            message: 'A new donation pledge has been submitted and is pending review.',
            type: 'donation_pledge',
            reference_id: result[0].id,
          },
        ]);
      } catch (err: any) {
        this.logger.error(`Failed to insert donation notification: ${err.message}`);
      }
    }

    return result;
  }

  async getLatestApplication(userId: string) {
    const { data, error } = await this.db
      .from('volunteer_applications')
      .select('*')
      .eq('volunteer_auth_id', userId)
      .order('applied_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(`Supabase Error: ${error.message}`);

    if (data && data.role_id) {
      const { data: role } = await this.db.from('volunteer_roles').select('*').eq('id', data.role_id).single();
      if (role) {
        data.volunteer_roles = role;
        if (role.campaign_id) {
          const { data: campaign } = await this.db
            .from('bh_campaigns')
            .select('id, title, name')
            .eq('id', role.campaign_id)
            .maybeSingle();
          data.campaign = campaign ?? null;
          data.venueName = campaign?.title ?? campaign?.name ?? role.location ?? null;
        }
      }
    }

    return data;
  }

  async getAllApplications(userId: string) {
    const [vRes, dRes, qrRes] = await Promise.all([
      this.db.from('volunteer_applications').select('*').eq('volunteer_auth_id', userId).order('applied_at', { ascending: false }),
      this.db.from('donations').select('*').eq('donor_auth_id', userId).order('donated_at', { ascending: false }),
      this.db.from('qr_codes').select('*').or(`volunteer_auth_id.eq.${userId},donor_auth_id.eq.${userId}`),
    ]);

    const qrCodes = qrRes.data ?? [];
    const applications: any[] = [];

    if (vRes.data && vRes.data.length > 0) {
      const roleIds = [...new Set(vRes.data.map((a: any) => a.role_id).filter(Boolean))];
      let rolesMap = new Map<string, any>();
      let campaignsMap = new Map<string, any>();

      if (roleIds.length > 0) {
        const { data: roles } = await this.db.from('volunteer_roles').select('*').in('id', roleIds);
        if (roles) {
          roles.forEach((r: any) => rolesMap.set(r.id, r));
          const campIds = [...new Set(roles.map((r: any) => r.campaign_id).filter(Boolean))];
          if (campIds.length > 0) {
            const { data: campaigns } = await this.db.from('bh_campaigns').select('id, title, name').in('id', campIds);
            (campaigns ?? []).forEach((c: any) => campaignsMap.set(c.id, c));
          }
        }
      }

      for (const app of vRes.data) {
        const qr = qrCodes.find((q: any) => q.application_id === app.id);
        const role = rolesMap.get(app.role_id);
        const campaign = role?.campaign_id ? campaignsMap.get(role.campaign_id) : null;
        const appType = role?.title ? `Volunteer - ${role.title}` : app.skills?.[0] ? `Volunteer - ${app.skills[0]}` : 'Volunteer Application';
        let normStatus = app.status ? app.status.toUpperCase() : 'PENDING';
        if (normStatus === 'SUBMITTED') normStatus = 'PENDING';
        if (normStatus === 'CONFIRMED') normStatus = 'APPROVED';

        applications.push({
          refId: app.id,
          applicantId: app.volunteer_auth_id,
          applicationType: appType,
          submittedAt: app.applied_at || app.created_at || new Date().toISOString(),
          status: normStatus,
          rejectionReason: null,
          updatedAt: app.applied_at || app.created_at || new Date().toISOString(),
          qrToken: qr?.public_url ?? null,
          venueName: campaign?.title ?? campaign?.name ?? role?.location ?? null,
          raw: { ...app, volunteer_roles: role ?? null, campaign: campaign ?? null },
        });
      }
    }

    if (dRes.data && dRes.data.length > 0) {
      const groupedDonations = new Map<string, any>();
      for (const d of dRes.data) {
        let key = d.transaction_ref;
        if (!key) {
          const dDate = new Date(d.donated_at || d.created_at || new Date());
          key = `DON-${dDate.toISOString().substring(0, 13)}`;
        }
        if (!groupedDonations.has(key)) {
          groupedDonations.set(key, { id: d.transaction_ref || d.id, items: [], status: d.status, donated_at: d.donated_at || d.created_at || new Date().toISOString(), donor_auth_id: d.donor_auth_id, donationIds: [] });
        }
        const group = groupedDonations.get(key);
        group.items.push(`${d.quantity} ${d.unit} of ${d.item_name}`);
        group.donationIds.push(d.id);
        if (d.status === 'pending') group.status = 'pending';
      }

      for (const [, group] of groupedDonations.entries()) {
        const qr = qrCodes.find((q: any) => group.donationIds.includes(q.donation_id) || q.donation_id === group.id);
        let normStatus = group.status ? group.status.toUpperCase() : 'PENDING';
        if (normStatus === 'SUBMITTED') normStatus = 'PENDING';
        if (normStatus === 'CONFIRMED') normStatus = 'APPROVED';
        applications.push({
          refId: group.id,
          applicantId: group.donor_auth_id,
          applicationType: `Donation - ${group.items.join(', ')}`,
          submittedAt: group.donated_at,
          status: normStatus,
          rejectionReason: null,
          updatedAt: group.donated_at,
          qrToken: qr?.public_url ?? null,
          raw: group,
        });
      }
    }

    applications.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    return applications;
  }

  async getMyMission(userId: string, applicationId?: string) {
    const context = await this.getMissionContext(userId, applicationId);
    return this.formatMissionResponse(context);
  }

  async getMyMissions(userId: string) {
    const { data: applications, error } = await this.db
      .from('volunteer_applications')
      .select('*')
      .eq('volunteer_auth_id', userId)
      .eq('status', 'approved')
      .order('applied_at', { ascending: false });

    if (error) throw new Error(`Unable to load volunteer applications: ${error.message}`);

    const approvedApplications = applications ?? [];
    const missionResponses = await Promise.all(
      approvedApplications.map(async (application: any) => {
        const context = await this.getMissionContext(userId, application.id);
        const response = this.formatMissionResponse(context);
        return {
          applicationId: application.id,
          submittedAt: application.applied_at ?? application.created_at ?? null,
          state: response.state,
          mission: response.mission,
          shift: response.shift,
        };
      }),
    );

    return missionResponses.sort((a, b) => {
      const aT = new Date(a.mission?.assignedAt ?? a.submittedAt ?? 0).getTime();
      const bT = new Date(b.mission?.assignedAt ?? b.submittedAt ?? 0).getTime();
      return bT - aT;
    });
  }

  async startMyMission(userId: string, applicationId?: string) {
    const context = await this.getMissionContext(userId, applicationId);
    if (!context.deployment) throw new Error('No mission has been assigned to your volunteer application yet.');
    if (!context.application?.qr_scanned_at) throw new Error('You cannot start your assigned task until your QR code has been scanned by the site manager.');
    if (context.shift?.status === 'pending' && context.shift.clock_out) throw new Error('Your clock-out request is waiting for site manager approval.');
    await this.ensureShiftForMission(userId, context);
    return this.getMyMission(userId, context.application?.id ?? applicationId);
  }

  async updateMyMissionTaskStatus(userId: string, status: MissionTaskStatus, applicationId?: string) {
    if (status !== 'in_progress' && status !== 'completed') throw new Error('Task status must be either in_progress or completed.');
    const context = await this.getMissionContext(userId, applicationId);
    if (!context.deployment) throw new Error('No mission has been assigned to your volunteer application yet.');
    if (context.shift?.status === 'pending' && context.shift.clock_out) throw new Error('Your clock-out request is already waiting for site manager approval.');
    if (status === 'completed' && !context.shift) throw new Error('Please start the mission before marking the task as completed.');
    await this.updateDeploymentStatus(context.deployment, status === 'completed' ? 'completed' : 'active');
    if (status === 'in_progress') await this.ensureShiftForMission(userId, context);
    return this.getMyMission(userId, context.application?.id ?? applicationId);
  }

  async requestMyMissionClockOut(userId: string, applicationId?: string) {
    const context = await this.getMissionContext(userId, applicationId);
    if (!context.deployment) throw new Error('No mission has been assigned to your volunteer application yet.');
    if (context.deployment.status !== 'completed') throw new Error('Please mark your assigned task as completed before requesting clock-out.');
    if (!context.shift) throw new Error('No active check-in was found. Please have your QR validated on-site first.');
    if (context.shift.status === 'pending' && context.shift.clock_out) return this.getMyMission(userId, context.application?.id ?? applicationId);
    if (context.shift.status === 'approved') throw new Error('This shift has already been approved.');

    await this.attachShiftToMissionIfPossible(context.shift, context);
    const { error } = await this.db.from('volunteer_shifts').update({ clock_out: new Date().toISOString(), status: 'pending' }).eq('id', context.shift.id);
    if (error) throw new Error(`Unable to request clock-out: ${error.message}`);

    try {
      await this.db.from('bh_notifications').insert([{
        target_role: 'siteman',
        title: 'Shift Pending Review',
        message: 'A volunteer has requested clock-out and the shift is pending review.',
        type: 'shift_review',
        reference_id: context.shift.id,
      }]);
    } catch (err: any) {
      this.logger.error(`Failed to insert clock-out notification: ${err.message}`);
    }

    return this.getMyMission(userId, context.application?.id ?? applicationId);
  }

  private async getMissionContext(userId: string, applicationId?: string): Promise<MissionContext> {
    const { data: applications, error: appError } = await this.db
      .from('volunteer_applications')
      .select('*')
      .eq('volunteer_auth_id', userId)
      .eq('status', 'approved')
      .order('applied_at', { ascending: false });

    if (appError) throw new Error(`Unable to load volunteer applications: ${appError.message}`);

    const approvedApplications = applicationId
      ? (applications ?? []).filter((a: any) => a.id === applicationId)
      : (applications ?? []);
    const shifts = await this.getVolunteerShifts(userId);

    if (approvedApplications.length === 0) {
      return { applications: [], deployment: null, role: null, application: null, campaign: null, zone: null, shift: this.pickRelevantShift(shifts, null, applicationId), shifts, deployments: [] };
    }

    const applicationIds = approvedApplications.map((a: any) => a.id).filter(Boolean);
    let deployments: any[] = [];
    if (applicationIds.length > 0) {
      const { data: deploymentRows, error: deploymentError } = await this.db
        .from('volunteer_deployments')
        .select('*')
        .in('application_id', applicationIds)
        .order('date_assigned', { ascending: false });
      if (deploymentError) throw new Error(`Unable to load mission assignments: ${deploymentError.message}`);
      deployments = deploymentRows ?? [];
    }

    const deployment =
      deployments.find((r: any) => ['active', 'assigned'].includes(String(r.status ?? '').toLowerCase())) ??
      deployments[0] ??
      null;

    const application = deployment
      ? approvedApplications.find((r: any) => r.id === deployment.application_id) ?? approvedApplications[0]
      : approvedApplications[0];

    const role = application?.role_id ? await this.fetchVolunteerRole(application.role_id) : null;
    const campaignId = deployment?.damayan_operation_id ?? deployment?.campaign_id ?? role?.campaign_id ?? null;
    const campaign = campaignId ? await this.fetchCampaignSnapshot(campaignId) : null;
    const shift = this.pickRelevantShift(shifts, deployment, application?.id ?? applicationId);

    return { applications: approvedApplications, deployment, role, application, campaign, zone: null, shift, shifts, deployments };
  }

  private async getVolunteerShifts(userId: string): Promise<any[]> {
    const { data, error } = await this.db
      .from('volunteer_shifts')
      .select('*')
      .eq('volunteer_auth_id', userId)
      .order('clock_in', { ascending: false })
      .limit(25);
    if (error) { this.logger.warn(`Unable to load shifts for ${userId}: ${error.message}`); return []; }
    return data ?? [];
  }

  private pickRelevantShift(shifts: any[], deployment?: any | null, applicationId?: string): any | null {
    if (!shifts.length) return null;
    const byDeployment = deployment?.id ? shifts.filter((s: any) => s.deployment_id === deployment.id) : [];
    const byApplication = applicationId ? shifts.filter((s: any) => s.application_id === applicationId) : [];
    const scopedPool = byDeployment.length > 0 ? byDeployment : byApplication;
    if (scopedPool.length === 0) return null;
    return (
      scopedPool.find((s: any) => ACTIVE_SHIFT_STATUSES.includes(String(s.status ?? '').toLowerCase())) ??
      scopedPool.find((s: any) => String(s.status ?? '').toLowerCase() === 'approved') ??
      scopedPool[0] ??
      null
    );
  }

  private async fetchVolunteerRole(roleId: string): Promise<any | null> {
    const { data, error } = await this.db.from('volunteer_roles').select('*').eq('id', roleId).maybeSingle();
    if (error) { this.logger.warn(`Unable to load role ${roleId}: ${error.message}`); return null; }
    return data ?? null;
  }

  private async fetchCampaignSnapshot(campaignId: string): Promise<any | null> {
    const { data: campaign, error } = await this.db.from('bh_campaigns').select('*').eq('id', campaignId).maybeSingle();
    if (error || !campaign) return null;
    const participation = await this.getCampaignParticipation(campaign.id, campaign.type ?? 'volunteer');
    const participantLimit = this.getCampaignLimit(campaign);
    return {
      source: 'bayanihub',
      id: campaign.id,
      title: campaign.title ?? campaign.name ?? 'Mission campaign',
      description: campaign.description ?? '',
      status: campaign.status ?? '',
      sitemanagerNotes: this.extractSitemanagerNotes(campaign.description),
      participantLimit,
      participantCount: participation,
      participantRemaining: participantLimit === null ? null : Math.max(0, participantLimit - participation),
      raw: campaign,
    };
  }

  private async updateDeploymentStatus(deployment: any, status: 'active' | 'completed') {
    if (!deployment?.id) return;
    const { error } = await this.db.from('volunteer_deployments').update({ status }).eq('id', deployment.id);
    if (error) throw new Error(`Unable to update task status: ${error.message}`);
  }

  private async ensureShiftForMission(userId: string, context: MissionContext) {
    const reusableShift = context.shift && context.shift.status !== 'approved' && !(context.shift.status === 'pending' && context.shift.clock_out);
    if (reusableShift) {
      const { error } = await this.db.from('volunteer_shifts').update({ status: 'pending', clock_out: null }).eq('id', context.shift.id);
      if (error) throw new Error(`Unable to update check-in: ${error.message}`);
      return;
    }
    await this.insertShiftWithFallback(userId, context);
  }

  private async insertShiftWithFallback(userId: string, context: MissionContext) {
    const now = new Date().toISOString();
    const campaignId = context.deployment?.damayan_operation_id ?? context.deployment?.campaign_id ?? context.role?.campaign_id ?? null;
    const richPayload: Record<string, any> = { volunteer_auth_id: userId, clock_in: now, status: 'pending' };
    if (context.application?.id) richPayload.application_id = context.application.id;
    if (campaignId) richPayload.campaign_id = campaignId;

    const { error } = await this.db.from('volunteer_shifts').insert([richPayload]);
    if (!error) return;

    this.logger.warn(`Shift insert failed, retrying without campaign_id: ${error.message}`);
    const fallbackPayload: Record<string, any> = { volunteer_auth_id: userId, clock_in: now, status: 'pending' };
    if (context.application?.id) fallbackPayload.application_id = context.application.id;
    const { error: fallbackError } = await this.db.from('volunteer_shifts').insert([fallbackPayload]);
    if (fallbackError) throw new Error(`Unable to create shift: ${fallbackError.message}`);
  }

  private async attachShiftToMissionIfPossible(shift: any, context: MissionContext) {
    if (!shift?.id) return;
    if (shift.application_id && shift.deployment_id) return;
    const campaignId = context.deployment?.damayan_operation_id ?? context.deployment?.campaign_id ?? context.role?.campaign_id ?? null;
    const payload = Object.fromEntries(
      Object.entries({
        application_id: shift.application_id ?? context.application?.id,
        deployment_id: shift.deployment_id ?? context.deployment?.id,
        campaign_id: shift.campaign_id ?? campaignId,
      }).filter(([, v]) => v !== undefined && v !== null),
    );
    if (Object.keys(payload).length === 0) return;
    const { error } = await this.db.from('volunteer_shifts').update(payload).eq('id', shift.id);
    if (error && !/application_id|deployment_id|campaign_id|schema cache|column .* does not exist/i.test(error.message)) {
      this.logger.warn(`Unable to attach shift to mission: ${error.message}`);
    }
  }

  private formatMissionResponse(context: MissionContext) {
    const reliability = this.calculateReliabilitySummary(context.deployments, context.shifts);

    if (context.applications.length === 0) {
      return { state: 'NO_APPROVED_APPLICATION', mission: null, shift: context.shift ? this.formatShift(context.shift) : null, reliability, postShiftSummary: null };
    }

    if (!context.deployment) {
      return { state: 'APPROVED_WAITING_ASSIGNMENT', mission: null, shift: context.shift ? this.formatShift(context.shift) : null, reliability, postShiftSummary: null };
    }

    const state = this.resolveMissionState(context.deployment, context.shift);
    const taskStatus = this.resolveTaskStatus(context.deployment, context.shift);

    return {
      state,
      mission: {
        deploymentId: context.deployment.id,
        applicationId: context.application?.id ?? context.deployment.application_id,
        campaignId: context.deployment.damayan_operation_id ?? context.deployment.campaign_id ?? context.role?.campaign_id ?? null,
        campaignTitle: context.campaign?.title ?? 'Assigned mission',
        campaignStatus: context.campaign?.status ?? '',
        roleTitle: context.role?.title ?? context.application?.skills?.[0] ?? 'Volunteer',
        taskDescription: context.deployment.task_description ?? 'Assigned by Site Manager',
        taskStatus,
        deploymentStatus: context.deployment.status ?? 'active',
        assignedAt: context.deployment.date_assigned ?? null,
        site: context.role?.location ?? context.campaign?.description ?? '',
        sitemanagerNotes: context.campaign?.sitemanagerNotes ?? null,
        participantLimit: context.campaign?.participantLimit ?? null,
        participantCount: context.campaign?.participantCount ?? null,
        participantRemaining: context.campaign?.participantRemaining ?? null,
        zone: null,
      },
      shift: context.shift ? this.formatShift(context.shift) : null,
      reliability,
      postShiftSummary:
        state === 'COMPLETED'
          ? {
              totalHours: Number(context.shift?.total_hours ?? 0),
              approvedAt: context.shift?.updated_at ?? context.shift?.created_at ?? null,
              completedTaskCount: reliability.metrics.completedTasks,
              score: reliability.score,
            }
          : null,
    };
  }

  private resolveMissionState(deployment: any, shift: any | null): string {
    const shiftStatus = String(shift?.status ?? '').toLowerCase();
    const deploymentStatus = String(deployment?.status ?? '').toLowerCase();
    const hasClockOut = Boolean(shift?.clock_out);
    if (shiftStatus === 'approved') return 'COMPLETED';
    if (shiftStatus === 'flagged') return 'CLOCK_OUT_DENIED';
    if (shiftStatus === 'pending' && hasClockOut) return 'CLOCK_OUT_REQUESTED';
    if (deploymentStatus === 'completed') return 'TASK_COMPLETED';
    if (shift && !hasClockOut) return deploymentStatus === 'active' ? 'IN_PROGRESS' : 'CHECKED_IN';
    return 'ASSIGNED';
  }

  private resolveTaskStatus(deployment: any, shift: any | null): 'assigned' | 'checked_in' | 'in_progress' | 'completed' {
    const deploymentStatus = String(deployment?.status ?? '').toLowerCase();
    if (deploymentStatus === 'completed') return 'completed';
    if (shift && !shift.clock_out) return deploymentStatus === 'active' ? 'in_progress' : 'checked_in';
    return 'assigned';
  }

  private formatShift(shift: any) {
    return { id: shift.id, status: shift.status ?? '', clockIn: shift.clock_in ?? null, clockOut: shift.clock_out ?? null, totalHours: Number(shift.total_hours ?? 0), reviewNote: shift.review_note ?? shift.notes ?? null };
  }

  private calculateReliabilitySummary(deployments: any[], shifts: any[]) {
    const completedTasks = deployments.filter((d: any) => d.status === 'completed').length;
    const approvedShifts = shifts.filter((s: any) => s.status === 'approved').length;
    const rejectedClockOuts = shifts.filter((s: any) => s.status === 'flagged').length;
    const approvedHours = shifts.filter((s: any) => s.status === 'approved').reduce((sum, s) => sum + Number(s.total_hours ?? 0), 0);
    const noShows = deployments.filter((d: any) => {
      const status = String(d.status ?? '').toLowerCase();
      if (!['active', 'assigned'].includes(status) || !d.date_assigned) return false;
      const assignedAt = new Date(d.date_assigned).getTime();
      const olderThanOneDay = Date.now() - assignedAt > 24 * 60 * 60 * 1000;
      const hasShift = shifts.some((s: any) => {
        const clockIn = s.clock_in ? new Date(s.clock_in).getTime() : 0;
        return Number.isFinite(clockIn) && clockIn >= assignedAt;
      });
      return olderThanOneDay && !hasShift;
    }).length;
    const efficiencyRatio = approvedHours > 0 ? completedTasks / approvedHours : completedTasks;
    const efficiencyBonus = Math.min(10, Math.round(efficiencyRatio * 4));
    const score = Math.max(0, Math.min(100, 50 + completedTasks * 8 + approvedShifts * 6 + efficiencyBonus - rejectedClockOuts * 10 - noShows * 12));
    return {
      score,
      label: score >= 85 ? 'Excellent' : score >= 70 ? 'Reliable' : score >= 50 ? 'Developing' : 'Needs review',
      metrics: { completedTasks, approvedShifts, approvedHours: Number(approvedHours.toFixed(2)), rejectedClockOuts, noShows, efficiencyBonus },
    };
  }

  private async enrichCampaignForEnduser(campaign: any, type: 'volunteer' | 'donation') {
    const participantLimit = type === 'volunteer' ? this.getCampaignLimit(campaign) : null;
    const participantCount = await this.getCampaignParticipation(campaign.id, type);
    const participantRemaining = participantLimit === null ? null : Math.max(0, participantLimit - participantCount);
    const roleSlots = type === 'volunteer' ? await this.getCampaignRoleSlots(campaign.id) : [];
    return {
      ...campaign,
      name: campaign.title,
      sitemanager_notes: this.extractSitemanagerNotes(campaign.description),
      participant_limit: participantLimit,
      participant_count: participantCount,
      participant_remaining: participantRemaining,
      role_slots: roleSlots,
      is_full: participantLimit !== null && participantCount >= participantLimit,
    };
  }

  private async assertCampaignCanAccept(campaignId: string, type: 'volunteer' | 'donation') {
    const { data: campaign, error } = await this.db.from('bh_campaigns').select('*').eq('id', campaignId).maybeSingle();
    if (error || !campaign) throw new Error(error?.message ?? 'Mission is not available.');
    if (campaign.type !== type || String(campaign.status ?? '').toLowerCase() !== 'active' || this.isCampaignClosed(campaign)) {
      throw new Error('This mission is closed and no longer accepts applications.');
    }
    if (type === 'donation') return;
    const participantLimit = this.getCampaignLimit(campaign);
    if (participantLimit === null) return;
    const participantCount = await this.getCampaignParticipation(campaignId, type);
    if (participantCount >= participantLimit) {
      await this.closeCampaign(campaignId);
      throw new Error('This mission has reached its application limit.');
    }
  }

  private async closeCampaignIfLimitReached(campaignId: string, type: 'volunteer' | 'donation') {
    if (type === 'donation') return;
    const { data: campaign } = await this.db.from('bh_campaigns').select('*').eq('id', campaignId).maybeSingle();
    if (!campaign) return;
    const participantLimit = this.getCampaignLimit(campaign);
    if (participantLimit === null) return;
    const participantCount = await this.getCampaignParticipation(campaignId, type);
    await this.updateCampaignCount(campaignId, participantCount);
    if (participantCount >= participantLimit) await this.closeCampaign(campaignId);
  }

  private async getCampaignParticipation(campaignId: string, type: string) {
    if (type === 'volunteer') {
      const { data: roles } = await this.db.from('volunteer_roles').select('id').eq('campaign_id', campaignId);
      const roleIds = (roles ?? []).map((r: any) => r.id).filter(Boolean);
      if (roleIds.length === 0) return 0;
      const { data } = await this.db.from('volunteer_applications').select('id, status').in('role_id', roleIds);
      return (data ?? []).filter((a: any) => !this.isTerminalApplicationStatus(a.status)).length;
    }
    const { data } = await this.db.from('donations').select('donor_auth_id, status').eq('campaign_id', campaignId);
    const activeDonorIds = new Set((data ?? []).filter((r: any) => !this.isTerminalApplicationStatus(r.status)).map((r: any) => r.donor_auth_id).filter(Boolean));
    return activeDonorIds.size;
  }

  private async getCampaignRoleSlots(campaignId: string) {
    const { data: roles, error } = await this.db.from('volunteer_roles').select('id, title, slots_total, status').eq('campaign_id', campaignId).order('title', { ascending: true });
    if (error || !roles?.length) return [];
    const roleIds = roles.map((r: any) => r.id).filter(Boolean);
    const { data: applications } = roleIds.length > 0 ? await this.db.from('volunteer_applications').select('role_id, status').in('role_id', roleIds) : { data: [] as any[] };
    return roles.map((r: any) => {
      const slotsTotal = Number(r.slots_total ?? 0);
      const activeCount = (applications ?? []).filter((a: any) => a.role_id === r.id && !this.isTerminalApplicationStatus(a.status)).length;
      return { id: r.id, title: r.title, slots_total: slotsTotal, slots_filled: activeCount, slots_remaining: slotsTotal > 0 ? Math.max(0, slotsTotal - activeCount) : null, is_full: slotsTotal > 0 && activeCount >= slotsTotal, status: r.status };
    });
  }

  private getCampaignLimit(campaign: any): number | null {
    const rawLimit = campaign?.participant_limit ?? campaign?.volunteers_needed ?? campaign?.donors_needed;
    const parsedColumnLimit = Number(rawLimit);
    if (Number.isFinite(parsedColumnLimit) && parsedColumnLimit > 0) return Math.round(parsedColumnLimit);
    const match = String(campaign?.description ?? '').match(/(?:Participant Limit|Volunteer Role Limit Total):\s*(\d+)/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
  }

  private extractSitemanagerNotes(description?: string | null) {
    const match = String(description ?? '').match(/(?:Sitemanager notes|SITEMAN Notes|Site Manager Notes):\s*([\s\S]*?)(?:\nDAMAYAN Source:|\nParticipant Limit:|\nVolunteer Role Limit Total:|\nDAMAYAN Status:|$)/i);
    return match?.[1]?.trim() || null;
  }

  private isTerminalApplicationStatus(status?: string | null) {
    return ['rejected', 'declined', 'cancelled', 'canceled', 'withdrawn'].includes(String(status ?? '').toLowerCase());
  }

  private async updateCampaignCount(campaignId: string, participantCount: number) {
    const { error } = await this.db.from('bh_campaigns').update({ participant_count: participantCount }).eq('id', campaignId);
    if (error && !/participant_count|schema cache|column .* does not exist/i.test(error.message)) {
      this.logger.warn(`Unable to update campaign participant count: ${error.message}`);
    }
  }

  private async closeCampaign(campaignId: string) {
    const now = new Date().toISOString();
    const { error } = await this.db.from('bh_campaigns').update({ status: 'completed', end_date: now, closed_at: now }).eq('id', campaignId);
    if (error && /closed_at|schema cache|column .* does not exist/i.test(error.message)) {
      await this.db.from('bh_campaigns').update({ status: 'completed', end_date: now }).eq('id', campaignId);
    }
  }

  private async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    const BUCKET = 'volunteer-documents';
    const filePath = `${folder}/${Date.now()}-${file.originalname}`;
    const { error: uploadError } = await this.db.storage.from(BUCKET).upload(filePath, file.buffer, { contentType: file.mimetype });
    if (uploadError) throw new Error(`File upload error: ${uploadError.message}`);
    const { data: urlData } = this.db.storage.from(BUCKET).getPublicUrl(filePath);
    return urlData.publicUrl;
  }

  private isCampaignClosed(campaign: any) {
    const status = String(campaign?.status ?? '').toLowerCase();
    if (['completed', 'cancelled', 'canceled', 'closed'].includes(status)) return true;
    if (!campaign?.end_date) return false;
    const endTime = new Date(campaign.end_date).getTime();
    return Number.isFinite(endTime) && endTime <= Date.now();
  }

  private async assertVolunteerHasNotApprovedForRole(userId: string, roleId: string) {
    const { data: existing, error } = await this.db
      .from('volunteer_applications')
      .select('id, status')
      .eq('volunteer_auth_id', userId)
      .eq('role_id', roleId)
      .eq('status', 'approved')
      .limit(1);
    if (error) throw new Error(`Unable to verify volunteer role history: ${error.message}`);
    if ((existing ?? []).length > 0) throw new Error('You have already been approved for this role on this mission.');
  }

  private async assertVolunteerRoleCanAccept(roleId: string) {
    const { data: role, error: roleError } = await this.db.from('volunteer_roles').select('id, title, slots_total').eq('id', roleId).maybeSingle();
    if (roleError) throw new Error(`Unable to verify role capacity: ${roleError.message}`);
    const slotsTotal = Number(role?.slots_total ?? 0);
    if (!Number.isFinite(slotsTotal) || slotsTotal <= 0) return;
    const { data: applications, error: appError } = await this.db.from('volunteer_applications').select('id, status').eq('role_id', roleId);
    if (appError) throw new Error(`Unable to verify role applications: ${appError.message}`);
    const activeCount = (applications ?? []).filter((a: any) => !this.isTerminalApplicationStatus(a.status)).length;
    if (activeCount >= slotsTotal) throw new Error(`${role?.title ?? 'This role'} has reached its volunteer limit for this mission.`);
  }
}
