import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '@app/supabase';

@Injectable()
export class OperationsService {
  private readonly logger = new Logger(OperationsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private db() {
    const client = this.supabaseService.getClient();
    if (!client) throw new Error('Supabase client not initialized');
    return client as any;
  }

  // ─── Overview (aggregated dashboard) ─────────────────────────────────────

  async getOverview(search?: string, disasterId?: string) {
    const [incidentReports, dispatchOrders, organizations, disasterEvents, reliefOperations] =
      await Promise.all([
        this.findIncidentReports(search, disasterId).catch((err: unknown) => {
          this.logger.warn(`[overview] findIncidentReports failed: ${String(err)}`);
          return [];
        }),
        this.findDispatchOrders(undefined, undefined, disasterId).catch((err: unknown) => {
          this.logger.warn(`[overview] findDispatchOrders failed: ${String(err)}`);
          return [];
        }),
        this.findVolunteerOrganizations().catch((err: unknown) => {
          this.logger.warn(`[overview] findVolunteerOrganizations failed: ${String(err)}`);
          return [];
        }),
        this.findDisasterEvents().catch((err: unknown) => {
          this.logger.warn(`[overview] findDisasterEvents failed: ${String(err)}`);
          return [];
        }),
        this.findReliefOperations(undefined, disasterId).catch((err: unknown) => {
          this.logger.warn(`[overview] findReliefOperations failed: ${String(err)}`);
          return [];
        }),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      incidentReports,
      dispatchOrders,
      organizations,
      disasterEvents,
      reliefOperations,
      // BayaniHub volunteer data is sourced externally — return graceful stubs
      volunteerUnits: [],
      volunteerTeams: [],
    };
  }

  // ─── Dispatcher Profile ───────────────────────────────────────────────────

  async getDispatcherProfile(dispatcherAuthUserId: string) {
    const db = this.db();
    const [{ data: profile, error: profileError }, authResult] = await Promise.all([
      db
        .from('user_profiles')
        .select('id, auth_user_id, first_name, last_name, phone, address, barangay, municipality, province, created_at')
        .eq('auth_user_id', dispatcherAuthUserId)
        .maybeSingle(),
      db.auth.admin.getUserById(dispatcherAuthUserId),
    ]);

    if (profileError) throw new BadRequestException(profileError.message);
    if (!profile) throw new BadRequestException('Dispatcher profile not found');

    const [totalDispatches, resolvedToday] = await Promise.all([
      this.countDispatches(dispatcherAuthUserId),
      this.countResolvedToday(dispatcherAuthUserId),
    ]);

    const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
    const initials =
      `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase() || 'DS';

    return {
      id: profile.id,
      authUserId: profile.auth_user_id,
      name: fullName,
      username:
        authResult?.data?.user?.email?.split('@')[0] ??
        fullName.toLowerCase().replace(/\s+/g, '.'),
      email: authResult?.data?.user?.email ?? '',
      phone: profile.phone ?? '',
      badge: `DS-${String(profile.id ?? profile.auth_user_id)
        .replace(/-/g, '')
        .slice(-4)
        .toUpperCase()}`,
      rank: this.resolveRank(totalDispatches),
      cluster:
        profile.municipality || profile.province || profile.barangay || 'Unassigned Cluster',
      station: profile.address
        ? profile.address
        : profile.municipality
          ? `${String(profile.municipality)} Command Center`
          : 'Unassigned Command Center',
      initials,
      joinedDate: profile.created_at
        ? new Date(profile.created_at).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'Not recorded',
      totalDispatches,
      resolvedToday,
    };
  }

  private resolveRank(totalDispatches: number): string {
    if (totalDispatches >= 1000) return 'Senior Dispatcher';
    if (totalDispatches >= 250) return 'Dispatcher II';
    return 'Dispatcher I';
  }

  private async countDispatches(dispatcherAuthUserId: string): Promise<number> {
    const { count, error } = await this.db()
      .from('dispatch_orders')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', dispatcherAuthUserId);
    if (error) return 0;
    return count ?? 0;
  }

  private async countResolvedToday(dispatcherAuthUserId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { count, error } = await this.db()
      .from('dispatch_orders')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', dispatcherAuthUserId)
      .eq('status', 'completed')
      .gte('updated_at', start.toISOString());
    if (error) return 0;
    return count ?? 0;
  }

  // ─── Incident Reports ─────────────────────────────────────────────────────

  async findIncidentReports(search?: string, disasterId?: string) {
    let query = this.db()
      .from('incident_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (search) query = query.ilike('title', `%${search}%`);
    if (disasterId) query = query.eq('disaster_id', disasterId);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createIncidentReport(payload: any) {
    const { data, error } = await this.db()
      .from('incident_reports')
      .insert(payload)
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateIncidentReport(id: string, payload: any) {
    const { data, error } = await this.db()
      .from('incident_reports')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Incident report ${id} not found`);
    return data;
  }

  async deleteIncidentReport(id: string) {
    const { error } = await this.db().from('incident_reports').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: `Incident report ${id} deleted` };
  }

  // ─── Dispatch Orders ──────────────────────────────────────────────────────

  async findDispatchOrders(search?: string, operationId?: string, disasterId?: string) {
    let query = this.db()
      .from('dispatch_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (search) query = query.ilike('notes', `%${search}%`);
    if (operationId) query = query.eq('operation_id', operationId);
    if (disasterId) query = query.eq('disaster_id', disasterId);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createDispatchOrder(dispatcherAuthUserId: string, payload: any) {
    const { reportId, ...rest } = payload as { reportId?: string; [key: string]: any };
    const { data, error } = await this.db()
      .from('dispatch_orders')
      .insert({ report_id: reportId ?? null, assigned_to: dispatcherAuthUserId, ...rest })
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);

    // Notify the citizen who submitted the incident report (best-effort)
    if (reportId && data) {
      void this.notifyCitizenOnDispatch(reportId, data.id as string).catch(() => {});
    }

    return data;
  }

  private async notifyCitizenOnDispatch(reportId: string, _dispatchOrderId: string) {
    try {
      const db = this.db();
      const { data } = await db
        .from('incident_reports')
        .select('reported_by')
        .eq('id', reportId)
        .maybeSingle();
      const citizenId = (data as { reported_by?: string } | null)?.reported_by;
      if (!citizenId) return;
      // In-app notification is handled by libs/common if available
      // For now we log; real push can be wired to a notification service later
      this.logger.log(`[dispatch] Notifying citizen ${citizenId} of dispatch assignment`);
    } catch {
      // non-fatal
    }
  }

  async updateDispatchOrder(id: string, payload: any) {
    const { data, error } = await this.db()
      .from('dispatch_orders')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Dispatch order ${id} not found`);
    return data;
  }

  async deleteDispatchOrder(id: string) {
    const { error } = await this.db().from('dispatch_orders').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: `Dispatch order ${id} deleted` };
  }

  // ─── Volunteer Organizations ──────────────────────────────────────────────
  // NOTE: BayaniHub external volunteer integration is not yet available.
  // findVolunteerUnits / findVolunteerTeams return graceful stubs (empty arrays)
  // until the BayaniHub API integration is configured via BAYANIHUB_API_URL.

  async findVolunteerOrganizations(search?: string) {
    let query = this.db()
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async findVolunteerUnits(_search?: string): Promise<any[]> {
    // BayaniHub integration stub — returns empty until BAYANIHUB_API_URL is configured
    const apiUrl = process.env['BAYANIHUB_API_URL'];
    if (!apiUrl) {
      this.logger.debug('[volunteers] BAYANIHUB_API_URL not set — returning empty volunteer units');
      return [];
    }
    try {
      const res = await fetch(`${apiUrl}/api/volunteer-units${_search ? `?search=${encodeURIComponent(_search)}` : ''}`);
      if (!res.ok) return [];
      return (await res.json()) as any[];
    } catch {
      this.logger.warn('[volunteers] BayaniHub API unreachable — returning empty volunteer units');
      return [];
    }
  }

  async findVolunteerTeams(_search?: string): Promise<any[]> {
    // BayaniHub integration stub — returns empty until BAYANIHUB_API_URL is configured
    const apiUrl = process.env['BAYANIHUB_API_URL'];
    if (!apiUrl) {
      this.logger.debug('[volunteers] BAYANIHUB_API_URL not set — returning empty volunteer teams');
      return [];
    }
    try {
      const res = await fetch(`${apiUrl}/api/volunteer-teams${_search ? `?search=${encodeURIComponent(_search)}` : ''}`);
      if (!res.ok) return [];
      return (await res.json()) as any[];
    } catch {
      this.logger.warn('[volunteers] BayaniHub API unreachable — returning empty volunteer teams');
      return [];
    }
  }

  async createVolunteerDispatch(payload: {
    reportId: string;
    assignedTo: string;
    volunteerName?: string;
    priority?: string;
    instructions?: string;
    disasterId?: string;
  }) {
    const priorityMap: Record<string, string> = {
      low: 'low',
      medium: 'normal',
      high: 'urgent',
      critical: 'critical',
    };
    const dbPriority = priorityMap[payload.priority?.toLowerCase() ?? ''] ?? 'normal';

    const instructionParts: string[] = [];
    if (payload.volunteerName) instructionParts.push(`Volunteer: ${payload.volunteerName}`);
    if (payload.instructions) instructionParts.push(payload.instructions);
    const instructions = instructionParts.join(' | ') || null;

    const { data, error } = await this.db()
      .from('dispatch_orders')
      .insert({
        report_id: payload.reportId,
        assigned_to: payload.assignedTo,
        external_volunteer_id: null,
        priority: dbPriority,
        instructions,
        disaster_id: payload.disasterId ?? null,
        operation_id: null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw new BadRequestException(error.message);
    return { id: (data as { id: string }).id };
  }

  // ─── Disaster Events (read-only for dispatcher) ───────────────────────────

  private async findDisasterEvents() {
    const { data, error } = await this.db()
      .from('disaster_events')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  // ─── Relief Operations (read-only for dispatcher) ─────────────────────────

  private async findReliefOperations(_search?: string, disasterId?: string) {
    let query = this.db()
      .from('relief_operations')
      .select('*')
      .order('created_at', { ascending: false });
    if (disasterId) query = query.eq('disaster_id', disasterId);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  // ─── Barangay / Location Data ─────────────────────────────────────────────

  async getBarangayData(province?: string) {
    let query = this.db()
      .from('ph_city_catalog')
      .select('psgc_code, city_name, province_name, region_name, latitude, longitude')
      .order('city_name', { ascending: true });
    if (province) query = query.ilike('province_name', `%${province}%`);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return ((data ?? []) as Array<{
      psgc_code: string;
      city_name: string;
      province_name: string | null;
      region_name: string | null;
      latitude: number;
      longitude: number;
    }>).map((row) => ({
      psgcCode: row.psgc_code,
      name: row.city_name,
      province: row.province_name ?? null,
      region: row.region_name ?? null,
      coordinates: [row.latitude, row.longitude] as [number, number],
    }));
  }

  // ─── Team Status ──────────────────────────────────────────────────────────

  async getTeamStatus() {
    const { data, error } = await this.db()
      .from('user_profiles')
      .select('id, auth_user_id, first_name, last_name, role, duty_status, municipality, province, barangay, address')
      .eq('role', 'line_manager')
      .eq('status', 'active')
      .order('first_name', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return ((data ?? []) as Array<{
      id: string;
      auth_user_id: string;
      first_name: string;
      last_name: string;
      role: string;
      duty_status: string;
      municipality: string | null;
      province: string | null;
      barangay: string | null;
      address: string | null;
    }>).map((row) => ({
      id: row.id,
      authUserId: row.auth_user_id,
      name: `${row.first_name} ${row.last_name}`.trim(),
      role: 'Site Manager',
      location:
        row.municipality || row.province || row.barangay || row.address || 'Unassigned',
      dutyStatus: row.duty_status as 'on_duty' | 'off_duty',
    }));
  }

  async setDutyStatus(targetAuthUserId: string, dutyStatus: 'on_duty' | 'off_duty') {
    const { error } = await this.db()
      .from('user_profiles')
      .update({ duty_status: dutyStatus, updated_at: new Date().toISOString() })
      .eq('auth_user_id', targetAuthUserId);
    if (error) throw new BadRequestException(error.message);
    return { authUserId: targetAuthUserId, dutyStatus };
  }

  // ─── Site Manager Account Status ──────────────────────────────────────────

  async getSiteManagerAccountStatuses() {
    const { data, error } = await this.db()
      .from('user_profiles')
      .select('id, first_name, last_name, status, role')
      .in('role', ['line_manager', 'site_manager']);
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  // ─── Broadcast ────────────────────────────────────────────────────────────

  async broadcast(
    dispatcherAuthUserId: string,
    payload: {
      message: string;
      title?: string;
      severity?: 'info' | 'warning' | 'critical';
      type?: string;
      areas?: string[];
      disasterId?: string;
    },
  ) {
    const message = payload.message?.trim();
    if (!message) throw new BadRequestException('Broadcast message is required');

    const severity = payload.severity ?? 'warning';
    const type = payload.type ?? 'Dispatcher Broadcast';
    const title = payload.title?.trim() || `${severity.toUpperCase()} ${type}`;
    const areas = payload.areas?.filter(Boolean) ?? [];

    const { error: alertError } = await this.db().from('drm_alerts').insert({
      id: randomUUID(),
      dispatcher_id: dispatcherAuthUserId,
      scope: areas.length > 0 ? 'barangay' : 'all',
      target: areas.length > 0 ? areas.join(', ') : null,
      title,
      message,
      severity,
      disaster_type: type,
      disaster_id: payload.disasterId ?? null,
      evacuation_center: null,
      instructions: [message],
    });

    if (alertError) throw new BadRequestException(alertError.message);

    // Count potential recipients (all users with a profile)
    const { count } = await this.db()
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .not('auth_user_id', 'is', null);

    this.logger.log(`[broadcast] "${title}" sent by ${dispatcherAuthUserId} to ~${count ?? 0} users`);

    return {
      title,
      message,
      severity,
      type,
      areas,
      estimatedRecipients: count ?? 0,
    };
  }
}
