import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';
import { UpsertAfterActionAssessmentDto } from './dto/after-action.dto';
import { CreateCheckInDto, ScanQrDto } from './dto/check-in.dto';

@Injectable()
export class OperationsService {
  private readonly logger = new Logger(OperationsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private db() {
    const client = this.supabaseService.getClient();
    if (!client) throw new Error('Supabase client not initialized');
    return client as any;
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  async getDashboard() {
    const db = this.db();
    const [checkIns, distributions, incidentReports, reliefOps] = await Promise.all([
      db.from('check_ins').select('id, status', { count: 'exact' }),
      db.from('distributions').select('id', { count: 'exact' }),
      db.from('incident_reports').select('id, severity', { count: 'exact' }),
      db.from('relief_operations').select('id, status', { count: 'exact' }),
    ]);
    return {
      activeCheckIns: (checkIns.data ?? []).filter((c: any) => c.status === 'checked_in').length,
      totalCheckIns: checkIns.count ?? 0,
      distributionCount: distributions.count ?? 0,
      incidentCount: incidentReports.count ?? 0,
      activeOperations: (reliefOps.data ?? []).filter((r: any) => r.status === 'active').length,
    };
  }

  // ─── After-Action Assessment ──────────────────────────────────────────────

  async getLatestAfterActionAssessment(disasterId?: string) {
    let query = this.db().from('after_action_assessments').select('*').order('created_at', { ascending: false });
    if (disasterId) query = query.eq('disaster_id', disasterId);
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async upsertAfterActionAssessment(dto: UpsertAfterActionAssessmentDto) {
    const payload: Record<string, unknown> = { disaster_id: dto.disasterId };
    if (dto.summary !== undefined) payload['summary'] = dto.summary;
    if (dto.lessonsLearned !== undefined) payload['lessons_learned'] = dto.lessonsLearned;
    if (dto.recommendations !== undefined) payload['recommendations'] = dto.recommendations;
    if (dto.status !== undefined) payload['status'] = dto.status;

    const { data, error } = await this.db()
      .from('after_action_assessments')
      .upsert(payload, { onConflict: 'disaster_id' })
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Inventory ───────────────────────────────────────────────────────────

  async findInventory(search?: string) {
    let query = this.db().from('inventory').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getInventoryStats() {
    const { data, error } = await this.db().from('inventory').select('id, quantity, category');
    if (error) throw new BadRequestException(error.message);
    const items = data ?? [];
    return {
      totalItems: items.length,
      totalQuantity: items.reduce((sum: number, i: any) => sum + (i.quantity ?? 0), 0),
    };
  }

  async findInventoryItem(id: string) {
    const { data, error } = await this.db().from('inventory').select('*').eq('id', id).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Inventory item ${id} not found`);
    return data;
  }

  async createInventoryItem(payload: any) {
    const { data, error } = await this.db().from('inventory').insert(payload).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateInventoryItem(id: string, payload: any) {
    const { data, error } = await this.db().from('inventory').update(payload).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Inventory item ${id} not found`);
    return data;
  }

  async adjustInventoryItem(id: string, payload: { adjustment: number; reason?: string }) {
    const item = await this.findInventoryItem(id);
    const newQty = (item.quantity ?? 0) + payload.adjustment;
    if (newQty < 0) throw new BadRequestException('Quantity cannot go below 0');
    const { data, error } = await this.db()
      .from('inventory')
      .update({ quantity: newQty })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteInventoryItem(id: string) {
    const { error } = await this.db().from('inventory').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: `Inventory item ${id} deleted` };
  }

  async receiveInventory(payload: { itemIds: string[]; quantities: number[]; arrivalTerminal?: string; waybillNumber?: string; condition?: string }) {
    const updates = payload.itemIds.map(async (itemId, i) => {
      const item = await this.findInventoryItem(itemId);
      const newQty = (item.quantity ?? 0) + (payload.quantities[i] ?? 0);
      return this.db().from('inventory').update({ quantity: newQty }).eq('id', itemId);
    });
    await Promise.all(updates);
    return { message: 'Inventory received' };
  }

  async createInventoryBatch(payload: { name?: string; items: Array<{ itemId: string; quantity: number }> }) {
    const { data, error } = await this.db()
      .from('inventory_batches')
      .insert({ name: payload.name, items: payload.items })
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Capacity ────────────────────────────────────────────────────────────

  async findCapacity(search?: string) {
    let query = this.db().from('evacuation_centers').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getCapacityStats() {
    const { data, error } = await this.db().from('evacuation_centers').select('id, capacity, current_occupancy');
    if (error) throw new BadRequestException(error.message);
    const centers = data ?? [];
    return {
      totalCenters: centers.length,
      totalCapacity: centers.reduce((s: number, c: any) => s + (c.capacity ?? 0), 0),
      totalOccupancy: centers.reduce((s: number, c: any) => s + (c.current_occupancy ?? 0), 0),
    };
  }

  // ─── Organizations ────────────────────────────────────────────────────────

  async findOrganizations(search?: string) {
    let query = this.db().from('organizations').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getOrganizationStats() {
    const { count, error } = await this.db().from('organizations').select('id', { count: 'exact' });
    if (error) throw new BadRequestException(error.message);
    return { totalOrganizations: count ?? 0 };
  }

  // ─── Disaster Events ──────────────────────────────────────────────────────

  async findDisasterEvents(search?: string) {
    let query = this.db().from('disaster_events').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getDisasterEventStats() {
    const { data, error } = await this.db().from('disaster_events').select('id, status');
    if (error) throw new BadRequestException(error.message);
    const events = data ?? [];
    return {
      total: events.length,
      active: events.filter((e: any) => e.status === 'active').length,
    };
  }

  // ─── Dispatch Orders ──────────────────────────────────────────────────────

  async findDispatchOrders(search?: string, operationId?: string) {
    let query = this.db().from('dispatch_orders').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('notes', `%${search}%`);
    if (operationId) query = query.eq('operation_id', operationId);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getDispatchOrderStats() {
    const { count, error } = await this.db().from('dispatch_orders').select('id', { count: 'exact' });
    if (error) throw new BadRequestException(error.message);
    return { total: count ?? 0 };
  }

  async createDispatchOrder(payload: any) {
    const { data, error } = await this.db().from('dispatch_orders').insert(payload).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateDispatchOrder(id: string, payload: any) {
    const { data, error } = await this.db().from('dispatch_orders').update(payload).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Dispatch order ${id} not found`);
    return data;
  }

  async deleteDispatchOrder(id: string) {
    const { error } = await this.db().from('dispatch_orders').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: `Dispatch order ${id} deleted` };
  }

  // ─── Relief Operations ────────────────────────────────────────────────────

  async findReliefOperations(search?: string, disasterId?: string) {
    let query = this.db().from('relief_operations').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('name', `%${search}%`);
    if (disasterId) query = query.eq('disaster_id', disasterId);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getReliefOperationStats() {
    const { data, error } = await this.db().from('relief_operations').select('id, status');
    if (error) throw new BadRequestException(error.message);
    const ops = data ?? [];
    return { total: ops.length, active: ops.filter((o: any) => o.status === 'active').length };
  }

  async createReliefOperation(payload: any) {
    const { data, error } = await this.db().from('relief_operations').insert(payload).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateReliefOperation(id: string, payload: any) {
    const { data, error } = await this.db().from('relief_operations').update(payload).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Relief operation ${id} not found`);
    return data;
  }

  async deleteReliefOperation(id: string) {
    const { error } = await this.db().from('relief_operations').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: `Relief operation ${id} deleted` };
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

  async getIncidentReportStats() {
    const { data, error } = await this.db().from('incident_reports').select('id, severity, status');
    if (error) throw new BadRequestException(error.message);
    const reports = data ?? [];
    return {
      total: reports.length,
      open: reports.filter((r: any) => r.status === 'open').length,
      critical: reports.filter((r: any) => r.severity === 'critical').length,
    };
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

  // ─── Distributions ────────────────────────────────────────────────────────

  async findDistributions(search?: string, operationId?: string) {
    let query = this.db().from('distributions').select('*').order('created_at', { ascending: false });
    if (operationId) query = query.eq('operation_id', operationId);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getDistributionStats() {
    const { count, error } = await this.db().from('distributions').select('id', { count: 'exact' });
    if (error) throw new BadRequestException(error.message);
    return { total: count ?? 0 };
  }

  async createDistribution(payload: any) {
    const { data, error } = await this.db().from('distributions').insert(payload).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateDistribution(id: string, payload: any) {
    const { data, error } = await this.db().from('distributions').update(payload).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Distribution ${id} not found`);
    return data;
  }

  async deleteDistribution(id: string) {
    const { error } = await this.db().from('distributions').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: `Distribution ${id} deleted` };
  }

  // ─── Citizens ─────────────────────────────────────────────────────────────

  async findCitizens(search?: string) {
    let query = this.db().from('citizens').select('*').order('created_at', { ascending: false });
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createCitizen(payload: any) {
    const { data, error } = await this.db().from('citizens').insert(payload).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateCitizen(id: string, payload: any) {
    const { data, error } = await this.db().from('citizens').update(payload).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Citizen ${id} not found`);
    return data;
  }

  async deleteCitizen(id: string) {
    const { error } = await this.db().from('citizens').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: `Citizen ${id} deleted` };
  }

  // ─── Families ─────────────────────────────────────────────────────────────

  async findFamilies(search?: string) {
    let query = this.db().from('family_members').select('*').order('created_at', { ascending: false });
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createFamily(payload: any) {
    const { data, error } = await this.db().from('family_members').insert(payload).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateFamily(id: string, payload: any) {
    const { data, error } = await this.db().from('family_members').update(payload).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Family member ${id} not found`);
    return data;
  }

  async deleteFamily(id: string) {
    const { error } = await this.db().from('family_members').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: `Family member ${id} deleted` };
  }

  // ─── Registrations ────────────────────────────────────────────────────────

  async getRegistrationStats() {
    const { count, error } = await this.db().from('registrations').select('id', { count: 'exact' });
    if (error) throw new BadRequestException(error.message);
    return { total: count ?? 0 };
  }

  // ─── Check-ins ────────────────────────────────────────────────────────────

  async findCheckIns(search?: string) {
    let query = this.db().from('check_ins').select('*, citizens(first_name, last_name)').order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getCheckInStats() {
    const { data, error } = await this.db().from('check_ins').select('id, status');
    if (error) throw new BadRequestException(error.message);
    const checkIns = data ?? [];
    return {
      total: checkIns.length,
      active: checkIns.filter((c: any) => c.status === 'checked_in').length,
    };
  }

  async getRecentCheckIns(limit = 10) {
    const { data, error } = await this.db()
      .from('check_ins')
      .select('*, citizens(first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async findCheckIn(id: string) {
    const { data, error } = await this.db().from('check_ins').select('*').eq('id', id).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Check-in ${id} not found`);
    return data;
  }

  async createManualCheckIn(dto: CreateCheckInDto) {
    const { data, error } = await this.db()
      .from('check_ins')
      .insert({ citizen_id: dto.citizenId, disaster_id: dto.disasterId, location: dto.location, notes: dto.notes, status: 'checked_in' })
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async scanQr(dto: ScanQrDto) {
    const { data: citizen, error: cErr } = await this.db()
      .from('citizens')
      .select('*')
      .eq('qr_code_id', dto.qrCode)
      .maybeSingle();
    if (cErr || !citizen) throw new NotFoundException('Citizen not found for QR code');

    const { data, error } = await this.db()
      .from('check_ins')
      .insert({ citizen_id: citizen.id, disaster_id: dto.disasterId, location: dto.location, status: 'checked_in' })
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return { citizen, checkIn: data };
  }

  async checkOut(id: string) {
    const { data, error } = await this.db()
      .from('check_ins')
      .update({ status: 'checked_out', checked_out_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Check-in ${id} not found`);
    return data;
  }

  // ─── Uploads ──────────────────────────────────────────────────────────────

  async createIncidentAttachmentUploadUrl(dto: { incidentReportId: string; fileName: string; contentType?: string; expiresIn?: number }) {
    const path = `incident-reports/${dto.incidentReportId}/${dto.fileName}`;
    const { data, error } = await this.db().storage
      .from('damayan-attachments')
      .createSignedUploadUrl(path);
    if (error) throw new BadRequestException(error.message);
    return { ...data, path };
  }

  async createObjectViewUrl(dto: { bucket: string; objectPath: string; expiresIn?: number }) {
    const { data, error } = await this.db().storage
      .from(dto.bucket)
      .createSignedUrl(dto.objectPath, dto.expiresIn ?? 3600);
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Operations close & reporting ─────────────────────────────────────────

  async closeOperations() {
    const { data, error } = await this.db()
      .from('relief_operations')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('status', 'active')
      .select();
    if (error) throw new BadRequestException(error.message);
    return { message: 'Operations closed', closedCount: (data ?? []).length };
  }

  async generateSiteSummaryReport() {
    const db = this.db();
    const [checkIns, distributions, incidents] = await Promise.all([
      db.from('check_ins').select('id, status', { count: 'exact' }),
      db.from('distributions').select('id', { count: 'exact' }),
      db.from('incident_reports').select('id, severity', { count: 'exact' }),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      totalCheckIns: checkIns.count ?? 0,
      activeCheckIns: (checkIns.data ?? []).filter((c: any) => c.status === 'checked_in').length,
      totalDistributions: distributions.count ?? 0,
      totalIncidents: incidents.count ?? 0,
      criticalIncidents: (incidents.data ?? []).filter((i: any) => i.severity === 'critical').length,
    };
  }
}
