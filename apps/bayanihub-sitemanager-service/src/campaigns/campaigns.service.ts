import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

type DamayanSourceType = 'relief_operation' | 'evacuation_center';

@Injectable()
export class CampaignsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db(): SupabaseClient {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  private get damayanDb(): SupabaseClient {
    const client = this.supabaseService.getClientForService('DAMAYAN');
    if (!client) throw new InternalServerErrorException('DAMAYAN database credentials are not configured.');
    return client;
  }

  private async getSignedUrl(bucket: string, path: string, expiresInSeconds = 3600): Promise<string | null> {
    const { data, error } = await this.db.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error) return null;
    return data?.signedUrl ?? null;
  }

  async findAll(type?: string, status?: string) {
    let query = this.db.from('bh_campaigns').select('*').order('created_at', { ascending: false });
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);

    const { data: campaigns, error } = await query;
    if (error) throw new BadRequestException(error.message);
    const items = (campaigns ?? []).filter((c) => !(status === 'active' && this.isCampaignClosed(c)));
    if (items.length === 0) return [];

    const orgIds = [...new Set(items.map((c) => c.org_id).filter(Boolean))];
    const campaignIds = items.map((c) => c.id);

    const [orgsRes, rolesRes] = await Promise.all([
      orgIds.length
        ? this.db.from('organizations').select('id, name, type, contact_email').in('id', orgIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      this.db.from('volunteer_roles').select('id, campaign_id, title, slots_total, slots_filled, status').in('campaign_id', campaignIds),
    ]);

    if (orgsRes.error) throw new BadRequestException(orgsRes.error.message);
    if (rolesRes.error) throw new BadRequestException(rolesRes.error.message);

    const orgMap = new Map((orgsRes.data ?? []).map((o) => [o.id, o]));
    const rolesMap: Record<string, any[]> = {};
    for (const r of rolesRes.data ?? []) {
      if (!rolesMap[r.campaign_id]) rolesMap[r.campaign_id] = [];
      rolesMap[r.campaign_id].push(r);
    }

    return items.map((c) => ({ ...c, organizations: orgMap.get(c.org_id) ?? null, volunteer_roles: rolesMap[c.id] ?? [] }));
  }

  async findOne(id: string) {
    const { data: campaign, error } = await this.db.from('bh_campaigns').select('*').eq('id', id).single();
    if (error || !campaign) throw new NotFoundException(`Campaign ${id} not found`);

    const [orgRes, rolesRes, donationsRes] = await Promise.all([
      (campaign as any).org_id
        ? this.db.from('organizations').select('id, name, type, contact_email, contact_phone, address, verified').eq('id', (campaign as any).org_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      this.db.from('volunteer_roles').select('id, title, description, requirements, slots_total, slots_filled, location, start_date, end_date, status').eq('campaign_id', id),
      this.db.from('donations').select('id, amount, currency, status, donated_at').eq('campaign_id', id),
    ]);

    let coverSignedUrl: string | null = null;
    if ((campaign as any).cover_image_key) {
      coverSignedUrl = await this.getSignedUrl('campaign-covers', (campaign as any).cover_image_key);
    }

    return {
      ...campaign,
      organizations: orgRes.data ?? null,
      volunteer_roles: rolesRes.data ?? [],
      donations: donationsRes.data ?? [],
      cover_signed_url: coverSignedUrl,
    };
  }

  async getDamayanSources() {
    const [reliefRes, centersRes] = await Promise.all([
      this.damayanDb.from('relief_operations').select('id, name, description, start_date, end_date, status, created_at').order('created_at', { ascending: false }),
      this.damayanDb.from('evacuation_centers').select('id, name, address, barangay, municipality, capacity, status, created_at').order('created_at', { ascending: false }),
    ]);

    if (reliefRes.error) throw new BadRequestException(`DAMAYAN relief operations error: ${reliefRes.error.message}`);
    if (centersRes.error) throw new BadRequestException(`DAMAYAN evacuation centers error: ${centersRes.error.message}`);

    const { data: campaigns, error: campaignsError } = await this.db.from('bh_campaigns').select('id, title, description, type, status, created_at, end_date');
    if (campaignsError) throw new BadRequestException(campaignsError.message);

    const normalizedRelief = (reliefRes.data ?? []).map((row: any) => this.normalizeDamayanSource(row, 'relief_operation', campaigns ?? []));
    const normalizedCenters = (centersRes.data ?? []).map((row: any) => this.normalizeDamayanSource(row, 'evacuation_center', campaigns ?? []));

    return { relief_operations: normalizedRelief, evacuation_centers: normalizedCenters };
  }

  async activateDamayanMission(dto: {
    source_type: DamayanSourceType;
    source_id: string;
    mission_type?: 'donation' | 'volunteer';
    notes?: string;
    volunteers_needed?: number;
    donors_needed?: number;
    participant_limit?: number;
    role_limits?: Record<string, number>;
  }) {
    if (!dto.source_type || !dto.source_id) throw new BadRequestException('DAMAYAN source type and source id are required.');

    const source = await this.fetchDamayanSource(dto.source_type, dto.source_id);
    const missionType = dto.mission_type ?? (dto.source_type === 'evacuation_center' ? 'volunteer' : 'donation');
    const participantLimit = this.resolveParticipantLimit(missionType, dto);
    const title = source.name ?? 'DAMAYAN Mission';
    const description = this.buildCampaignDescription(source, dto.source_type, dto.notes, participantLimit);
    const createdBy = await this.resolveCampaignCreatorId();

    const existing = await this.findExistingActivatedCampaign(title, dto.source_id, dto.source_type, missionType);
    if (existing) {
      const wasActive = existing.status === 'active';
      const activeCampaign = await this.ensureCampaignActive(existing, source, dto.source_type, missionType, dto.notes, participantLimit);
      await this.ensureVolunteerRoles(activeCampaign.id, source, missionType, participantLimit, dto.role_limits);

      if (!wasActive) {
        try {
          await this.db.from('bh_notifications').insert({ target_role: 'volunteer', title: `New Mission Activated: ${title}`, message: `A new mission "${title}" has been activated.`, type: 'mission_activated', reference_id: activeCampaign.id });
        } catch (err: any) { console.error(`Failed to trigger notification: ${err.message}`); }
      }

      return { success: true, campaign: activeCampaign, created: false, message: wasActive ? `${title} is active in BayaniHub.` : `${title} was reactivated in BayaniHub.` };
    }

    let sourceEndDate = source.end_date ?? null;
    if (sourceEndDate && new Date(sourceEndDate).getTime() <= Date.now()) sourceEndDate = null;

    const campaignPayload = this.cleanPayload({
      title,
      description,
      type: missionType,
      status: 'active',
      target_amount: missionType === 'donation' ? 0 : null,
      current_amount: 0,
      participant_limit: participantLimit,
      participant_count: 0,
      start_date: source.start_date ?? source.created_at ?? null,
      end_date: sourceEndDate,
      created_by: createdBy,
    });

    const campaign = await this.insertCampaignWithFallback(campaignPayload);
    await this.ensureVolunteerRoles(campaign.id, source, missionType, participantLimit, dto.role_limits);

    try {
      await this.db.from('bh_notifications').insert({ target_role: 'volunteer', title: `New Mission Activated: ${title}`, message: `A new mission "${title}" has been activated.`, type: 'mission_activated', reference_id: campaign.id });
    } catch (err: any) { console.error(`Failed to trigger notification: ${err.message}`); }

    return { success: true, campaign, created: true, message: `${title} was activated for ${missionType === 'volunteer' ? 'volunteer applications' : 'donation pledges'}.` };
  }

  async closeCampaign(id: string) {
    const now = new Date().toISOString();
    let campaign: any = null;
    let lastError: any = null;
    const statusCandidates = ['closed', 'completed', 'cancelled', 'draft'];

    for (const status of statusCandidates) {
      const payload = this.cleanPayload({ status, end_date: now, closed_at: now, closed_reason: 'Closed by site manager' });
      const { data, error } = await this.db.from('bh_campaigns').update(payload).eq('id', id).select('*').single();
      if (!error && data) { campaign = data; break; }
      lastError = error;
      if (error && this.isMissingColumnError(error.message)) {
        const fallback = await this.db.from('bh_campaigns').update({ status, end_date: now }).eq('id', id).select('*').single();
        if (!fallback.error && fallback.data) { campaign = fallback.data; break; }
        lastError = fallback.error;
      }
      if (lastError && !/check constraint|violates/i.test(lastError.message ?? '')) break;
    }

    if (!campaign) {
      const closedByDate = await this.closeCampaignByDate(id, now);
      if (!closedByDate) throw new BadRequestException(lastError?.message ? `Unable to close mission: ${lastError.message}` : 'Unable to close mission.');
      campaign = closedByDate;
    }

    const rolesClosed = await this.db.from('volunteer_roles').update({ status: 'closed' }).eq('campaign_id', id);
    if (rolesClosed.error) await this.db.from('volunteer_roles').update({ status: 'inactive' }).eq('campaign_id', id);

    return { success: true, campaign, message: `${campaign.title ?? 'Mission'} has been closed.` };
  }

  private normalizeDamayanSource(row: any, sourceType: DamayanSourceType, campaigns: any[]) {
    const missionType = sourceType === 'evacuation_center' ? 'volunteer' : 'donation';
    const marker = this.sourceMarker(row.id, sourceType);
    const activated = campaigns.find((c) => c.type === missionType && typeof c.description === 'string' && c.description.includes(marker));
    const activatedClosed = activated ? this.isCampaignClosed(activated) : false;
    return { ...row, source_type: sourceType, mission_type: missionType, activated_campaign_id: activated?.id ?? null, activated_status: activatedClosed ? 'closed' : activated?.status ?? null };
  }

  private isCampaignClosed(campaign: any) {
    const status = String(campaign?.status ?? '').toLowerCase();
    if (['completed', 'cancelled', 'canceled', 'closed'].includes(status)) return true;
    if (!campaign?.end_date) return false;
    const endTime = new Date(campaign.end_date).getTime();
    return Number.isFinite(endTime) && endTime <= Date.now();
  }

  private async closeCampaignByDate(id: string, now: string) {
    const payload = this.cleanPayload({ end_date: now, closed_at: now, closed_reason: 'Closed by site manager' });
    const { data, error } = await this.db.from('bh_campaigns').update(payload).eq('id', id).select('*').single();
    if (!error && data) return data;
    if (error && this.isMissingColumnError(error.message)) {
      const fallback = await this.db.from('bh_campaigns').update({ end_date: now }).eq('id', id).select('*').single();
      if (!fallback.error && fallback.data) return fallback.data;
    }
    return null;
  }

  private async fetchDamayanSource(sourceType: DamayanSourceType, sourceId: string): Promise<any> {
    const table = sourceType === 'evacuation_center' ? 'evacuation_centers' : 'relief_operations';
    const columns = sourceType === 'evacuation_center'
      ? 'id, name, address, barangay, municipality, capacity, status, created_at'
      : 'id, name, description, start_date, end_date, status, created_at';
    const { data, error } = await this.damayanDb.from(table).select(columns).eq('id', sourceId).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`DAMAYAN ${sourceType.replace('_', ' ')} not found`);
    return data as any;
  }

  private async findExistingActivatedCampaign(title: string, sourceId: string, sourceType: DamayanSourceType, missionType: string) {
    const marker = this.sourceMarker(sourceId, sourceType);
    const { data, error } = await this.db.from('bh_campaigns').select('*').eq('type', missionType).ilike('title', title).limit(10);
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).find((c) => typeof c.description === 'string' && c.description.includes(marker)) ?? null;
  }

  private async ensureVolunteerRoles(campaignId: string, source: any, missionType: string, volunteersNeeded = 12, roleLimits?: Record<string, number>) {
    if (missionType !== 'volunteer') return;
    const { data: existingRoles, error: existingError } = await this.db.from('volunteer_roles').select('id, title').eq('campaign_id', campaignId);
    if (existingError) throw new BadRequestException(existingError.message);

    const existingTitles = new Set((existingRoles ?? []).map((role) => String(role.title ?? '').toLowerCase()));
    const location = [source.address, source.barangay, source.municipality].filter(Boolean).join(', ');
    const roleTitles = ['Medic', 'Logistics', 'Field'];
    const slotsByTitle = this.resolveRoleSlots(volunteersNeeded, roleTitles, roleLimits);

    for (const role of existingRoles ?? []) {
      const slotsTotal = slotsByTitle.get(String(role.title ?? '').toLowerCase());
      if (!slotsTotal) continue;
      await this.db.from('volunteer_roles').update({ slots_total: slotsTotal, status: 'open' }).eq('id', role.id);
    }

    const roles = roleTitles
      .filter((t) => !existingTitles.has(t.toLowerCase()))
      .map((t) => this.cleanPayload({ campaign_id: campaignId, title: t, description: `${t} support for ${source.name}`, requirements: t === 'Medic' ? 'Medical or first aid experience preferred.' : 'On-site disaster response readiness required.', slots_total: slotsByTitle.get(t.toLowerCase()) ?? 1, slots_filled: 0, location, start_date: source.created_at ?? null, end_date: null, status: 'open' }));

    if (roles.length === 0) return;
    const { error } = await this.db.from('volunteer_roles').insert(roles);
    if (error) throw new BadRequestException(error.message);
  }

  private async ensureCampaignActive(existingCampaign: any, source: any, sourceType: DamayanSourceType, missionType: string, notes?: string, participantLimit?: number) {
    let sourceEndDate = source.end_date ?? null;
    if (sourceEndDate && new Date(sourceEndDate).getTime() <= Date.now()) sourceEndDate = null;

    const refreshedPayload = {
      ...this.cleanPayload({ description: this.buildCampaignDescription(source, sourceType, notes, participantLimit), status: 'active', type: missionType, participant_limit: participantLimit, start_date: source.start_date ?? source.created_at ?? existingCampaign.start_date ?? null }),
      end_date: sourceEndDate,
      closed_at: null,
      closed_reason: null,
    };

    let { data, error } = await this.db.from('bh_campaigns').update(refreshedPayload).eq('id', existingCampaign.id).select('*').single();
    if (error && this.isMissingColumnError(error.message)) {
      const fallbackPayload = this.withoutCapacityColumns(refreshedPayload);
      const fallback = await this.db.from('bh_campaigns').update(fallbackPayload).eq('id', existingCampaign.id).select('*').single();
      data = fallback.data;
      error = fallback.error;
    }
    if (error || !data) throw new BadRequestException(error?.message ?? 'Unable to reactivate existing BayaniHub mission.');
    return data;
  }

  private async resolveCampaignCreatorId() {
    const { data, error } = await this.db.from('user_profiles').select('auth_user_id, role, created_at, updated_at').not('auth_user_id', 'is', null).limit(200);
    if (error) throw new BadRequestException(`Unable to resolve campaign creator: ${error.message}`);

    const profiles = (data ?? []).filter((p) => p.auth_user_id);
    const rolePriority = (role: string | null | undefined) => {
      const normalized = String(role ?? '').trim().toLowerCase();
      if (normalized === 'admin') return 0;
      if (['site_manager', 'site manager', 'siteman', 'site-manager'].includes(normalized)) return 1;
      if (['staff', 'operator'].includes(normalized)) return 2;
      return 10;
    };

    const sortedProfiles = [...profiles].sort((a, b) => {
      const roleDelta = rolePriority(a.role) - rolePriority(b.role);
      if (roleDelta !== 0) return roleDelta;
      return new Date(b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    });

    const creatorId = sortedProfiles[0]?.auth_user_id;
    if (creatorId) return creatorId;

    const { data: usersData, error: usersError } = await this.db.auth.admin.listUsers();
    if (usersError) throw new BadRequestException(`Unable to resolve fallback creator: ${usersError.message}`);
    const fallbackUserId = usersData?.users?.[0]?.id;
    if (!fallbackUserId) throw new BadRequestException('No BayaniHub auth user is available to mark as campaign creator.');
    return fallbackUserId;
  }

  private buildCampaignDescription(source: any, sourceType: DamayanSourceType, notes?: string, participantLimit?: number) {
    const lines = [
      source.description,
      source.address ? `Address: ${source.address}` : null,
      source.barangay || source.municipality ? `Location: ${[source.barangay, source.municipality].filter(Boolean).join(', ')}` : null,
      participantLimit ? `Volunteer Role Limit Total: ${participantLimit}` : null,
      `DAMAYAN Status: ${source.status ?? 'unknown'}`,
      `DAMAYAN Created: ${source.created_at ?? 'unknown'}`,
      notes ? `Site Manager Notes: ${notes}` : null,
      this.sourceMarker(source.id, sourceType),
    ];
    return lines.filter(Boolean).join('\n');
  }

  private sourceMarker(sourceId: string, sourceType: DamayanSourceType) {
    return `DAMAYAN Source: ${sourceType}:${sourceId}`;
  }

  private cleanPayload(payload: Record<string, any>) {
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null));
  }

  private resolveParticipantLimit(missionType: string, dto: { volunteers_needed?: number; donors_needed?: number; participant_limit?: number; role_limits?: Record<string, number> }) {
    if (missionType === 'donation') return undefined;
    const roleTotal = Object.values(dto.role_limits ?? {}).reduce((sum, v) => { const p = Number(v); return sum + (Number.isFinite(p) && p > 0 ? Math.round(p) : 0); }, 0);
    const raw = roleTotal || dto.volunteers_needed || dto.participant_limit || 12;
    return Math.max(1, Math.round(Number(raw)));
  }

  private resolveRoleSlots(total: number, roleTitles: string[], roleLimits?: Record<string, number>) {
    const slots = new Map<string, number>();
    const hasExplicitLimits = roleLimits && Object.keys(roleLimits).length > 0;
    if (hasExplicitLimits) {
      roleTitles.forEach((title) => { const raw = roleLimits?.[title] ?? roleLimits?.[title.toLowerCase()]; const parsed = Number(raw); slots.set(title.toLowerCase(), Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1); });
      return slots;
    }
    const cleanTotal = Math.max(1, Math.round(Number(total || 1)));
    const base = Math.floor(cleanTotal / roleTitles.length);
    const remainder = cleanTotal % roleTitles.length;
    roleTitles.forEach((title, index) => { slots.set(title.toLowerCase(), Math.max(1, base + (index < remainder ? 1 : 0))); });
    return slots;
  }

  private async insertCampaignWithFallback(campaignPayload: Record<string, any>) {
    const { data, error } = await this.db.from('bh_campaigns').insert(campaignPayload).select('*').single();
    if (!error && data) return data;
    if (error && this.isMissingColumnError(error.message)) {
      const fallback = await this.db.from('bh_campaigns').insert(this.withoutCapacityColumns(campaignPayload)).select('*').single();
      if (!fallback.error && fallback.data) return fallback.data;
      throw new BadRequestException(fallback.error?.message ?? 'Unable to create campaign.');
    }
    throw new BadRequestException(error?.message ?? 'Unable to create campaign.');
  }

  private withoutCapacityColumns(payload: Record<string, any>) {
    const { participant_limit, participant_count, closed_at, closed_reason, ...rest } = payload;
    void participant_limit; void participant_count; void closed_at; void closed_reason;
    return rest;
  }

  private isMissingColumnError(message?: string) {
    return /participant_limit|participant_count|closed_at|closed_reason|column .* does not exist|schema cache/i.test(message ?? '');
  }
}
