import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  // ─── Incident Reports ─────────────────────────────────────────────────────

  async findIncidentReports(search?: string, disasterId?: string) {
    let query = this.db().from('incident_reports').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('title', `%${search}%`);
    if (disasterId) query = query.eq('disaster_id', disasterId);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createIncidentReport(payload: any) {
    const { data, error } = await this.db().from('incident_reports').insert(payload).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateIncidentReport(id: string, payload: any) {
    const { data, error } = await this.db().from('incident_reports').update(payload).eq('id', id).select().maybeSingle();
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

  async findDispatchOrders(search?: string, operationId?: string) {
    let query = this.db().from('dispatch_orders').select('*').order('created_at', { ascending: false });
    if (operationId) query = query.eq('operation_id', operationId);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createDispatchOrder(payload: any) {
    const { data, error } = await this.db().from('dispatch_orders').insert(payload).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Volunteer Organizations ──────────────────────────────────────────────

  async findVolunteerOrganizations(search?: string) {
    let query = this.db().from('organizations').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
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
}
