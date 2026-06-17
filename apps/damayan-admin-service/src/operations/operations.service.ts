import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';
import { CreateItemDto, UpdateItemDto, AdjustQuantityDto } from './dto/inventory.dto';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { CreateDisasterEventDto, UpdateDisasterEventDto } from './dto/disaster-event.dto';
import { CreateDispatchOrderDto, UpdateDispatchOrderDto } from './dto/dispatch-order.dto';
import { CreateReliefOperationDto, UpdateReliefOperationDto } from './dto/relief-operation.dto';
import { CreateIncidentReportDto, UpdateIncidentReportDto } from './dto/incident-report.dto';
import { CreateDistributionDto, UpdateDistributionDto } from './dto/distribution.dto';
import { CreateCitizenDto, UpdateCitizenDto, CreateFamilyDto, UpdateFamilyDto } from './dto/registration.dto';
import { CreateDisasterCoverUploadDto, CreateIncidentAttachmentUploadDto, CreateObjectViewUrlDto, CreateWarningBroadcastDto } from './dto/uploads.dto';

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
    const [inventory, organizations, disasterEvents, registrations, checkIns, incidentReports] = await Promise.all([
      db.from('inventory').select('id, quantity', { count: 'exact' }),
      db.from('organizations').select('id', { count: 'exact' }),
      db.from('disaster_events').select('id, status', { count: 'exact' }),
      db.from('registrations').select('id', { count: 'exact' }),
      db.from('check_ins').select('id, status', { count: 'exact' }),
      db.from('incident_reports').select('id, severity', { count: 'exact' }),
    ]);
    return {
      inventoryCount: inventory.count ?? 0,
      organizationCount: organizations.count ?? 0,
      activeDisasters: (disasterEvents.data ?? []).filter((e: any) => e.status === 'active').length,
      totalDisasters: disasterEvents.count ?? 0,
      registrationCount: registrations.count ?? 0,
      activeCheckIns: (checkIns.data ?? []).filter((c: any) => c.status === 'checked_in').length,
      incidentCount: incidentReports.count ?? 0,
    };
  }

  async getSystemHealth() {
    const db = this.db();
    const { data: settings } = await db.from('system_settings').select('*').eq('id', 1).maybeSingle();
    const { data: pendingApprovals } = await db.from('user_profiles').select('id', { count: 'exact' }).eq('status', 'pending');
    return { settings, pendingApprovalsCount: pendingApprovals?.length ?? 0 };
  }

  // ─── Approvals ────────────────────────────────────────────────────────────

  async findPendingApprovals() {
    const { data, error } = await this.db().from('user_profiles').select('id, first_name, last_name, role, status, auth_user_id, profile_photo_key').eq('status', 'pending');
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async approvePendingUser(id: string) {
    const { data, error } = await this.db().from('user_profiles').update({ status: 'active' }).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`User ${id} not found`);
    return { message: 'User approved', user: data };
  }

  async rejectPendingUser(id: string, rejectReason: string) {
    const { data, error } = await this.db().from('user_profiles').update({ status: 'rejected', reject_reason: rejectReason }).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`User ${id} not found`);
    return { message: 'User rejected', user: data };
  }

  async triggerVerification(id: string) {
    // Fetch profile to get profile_photo_key for OCR re-submission
    const { data: profile, error } = await this.db()
      .from('user_profiles')
      .select('id, auth_user_id, profile_photo_key, first_name, last_name')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!profile) throw new NotFoundException(`User ${id} not found`);
    // Mark profile as under_review
    await this.db().from('user_profiles').update({ status: 'under_review' }).eq('id', id);
    return { message: 'Verification triggered', userId: id, profilePhotoKey: profile.profile_photo_key };
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
      lowStock: items.filter((i: any) => (i.quantity ?? 0) < 10).length,
    };
  }

  async createInventoryItem(dto: CreateItemDto) {
    const { data, error } = await this.db().from('inventory').insert(dto).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateInventoryItem(id: string, dto: UpdateItemDto) {
    const { data, error } = await this.db().from('inventory').update(dto).eq('id', id).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async adjustInventoryItem(id: string, dto: AdjustQuantityDto) {
    const db = this.db();
    const { data: item, error: fetchError } = await db.from('inventory').select('quantity').eq('id', id).single();
    if (fetchError) throw new BadRequestException(fetchError.message);
    const newQuantity = (item.quantity ?? 0) + dto.amount;
    const { data, error } = await db.from('inventory').update({ quantity: newQuantity }).eq('id', id).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Capacity ────────────────────────────────────────────────────────────

  async findCapacity(search?: string) {
    let query = this.db().from('shelter_capacity').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getCapacityStats() {
    const { data, error } = await this.db().from('shelter_capacity').select('capacity, current_occupancy');
    if (error) throw new BadRequestException(error.message);
    const shelters = data ?? [];
    return {
      totalShelters: shelters.length,
      totalCapacity: shelters.reduce((s: number, i: any) => s + (i.capacity ?? 0), 0),
      totalOccupancy: shelters.reduce((s: number, i: any) => s + (i.current_occupancy ?? 0), 0),
    };
  }

  async createEvacuationCenter(body: {
    name: string;
    address?: string;
    barangay?: string;
    municipality?: string;
    capacity?: number;
    facilities?: string[];
    contactPerson?: string;
    contactPhone?: string;
    lat?: number;
    lng?: number;
    description?: string;
    maxManagers?: number;
  }) {
    const { data, error } = await this.db()
      .from('evacuation_centers')
      .insert({
        name: body.name,
        address: body.address ?? null,
        barangay: body.barangay ?? null,
        municipality: body.municipality ?? null,
        capacity: body.capacity ?? null,
        facilities: body.facilities ?? [],
        contact_person: body.contactPerson ?? null,
        contact_phone: body.contactPhone ?? null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        description: body.description ?? null,
        max_managers: body.maxManagers ?? null,
      })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Organizations ───────────────────────────────────────────────────────

  async findOrganizations(search?: string) {
    let query = this.db().from('organizations').select('*').order('name', { ascending: true });
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getOrganizationStats() {
    const { count, error } = await this.db().from('organizations').select('id', { count: 'exact' });
    if (error) throw new BadRequestException(error.message);
    return { total: count ?? 0 };
  }

  async createOrganization(dto: CreateOrganizationDto) {
    const { data, error } = await this.db().from('organizations').insert(dto).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateOrganization(id: string, dto: UpdateOrganizationDto) {
    const { data, error } = await this.db().from('organizations').update(dto).eq('id', id).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteOrganization(id: string) {
    const { error } = await this.db().from('organizations').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Organization deleted' };
  }

  // ─── Disaster Events ─────────────────────────────────────────────────────

  async findDisasterEvents(search?: string, status?: string) {
    let query = this.db().from('disaster_events').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('title', `%${search}%`);
    if (status) query = query.eq('status', status);
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
      closed: events.filter((e: any) => e.status === 'closed').length,
    };
  }

  async createDisasterEvent(dto: CreateDisasterEventDto) {
    const { data, error } = await this.db().from('disaster_events').insert(dto).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateDisasterEvent(id: string, dto: UpdateDisasterEventDto) {
    const { data, error } = await this.db().from('disaster_events').update(dto).eq('id', id).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteDisasterEvent(id: string) {
    const { error } = await this.db().from('disaster_events').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Disaster event deleted' };
  }

  // ─── Dispatch Orders ─────────────────────────────────────────────────────

  async findDispatchOrders(search?: string, operationId?: string) {
    let query = this.db().from('dispatch_orders').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('description', `%${search}%`);
    if (operationId) query = query.eq('operation_id', operationId);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getDispatchOrderStats() {
    const { data, error } = await this.db().from('dispatch_orders').select('id, status');
    if (error) throw new BadRequestException(error.message);
    const orders = data ?? [];
    return {
      total: orders.length,
      pending: orders.filter((o: any) => o.status === 'pending').length,
      completed: orders.filter((o: any) => o.status === 'completed').length,
    };
  }

  async createDispatchOrder(dto: CreateDispatchOrderDto) {
    const { data, error } = await this.db().from('dispatch_orders').insert({ operation_id: dto.operationId, organization_id: dto.organizationId, description: dto.description, priority: dto.priority, items: dto.items }).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateDispatchOrder(id: string, dto: UpdateDispatchOrderDto) {
    const { data, error } = await this.db().from('dispatch_orders').update(dto).eq('id', id).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteDispatchOrder(id: string) {
    const { error } = await this.db().from('dispatch_orders').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Dispatch order deleted' };
  }

  // ─── Relief Operations ───────────────────────────────────────────────────

  async findReliefOperations(search?: string, disasterId?: string) {
    let query = this.db().from('relief_operations').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('title', `%${search}%`);
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

  async createReliefOperation(dto: CreateReliefOperationDto) {
    const { data, error } = await this.db().from('relief_operations').insert({ disaster_id: dto.disasterId, title: dto.title, description: dto.description, location: dto.location, type: dto.type, status: dto.status ?? 'active' }).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateReliefOperation(id: string, dto: UpdateReliefOperationDto) {
    const { data, error } = await this.db().from('relief_operations').update(dto).eq('id', id).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteReliefOperation(id: string) {
    const { error } = await this.db().from('relief_operations').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Relief operation deleted' };
  }

  // ─── Incident Reports ────────────────────────────────────────────────────

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
      critical: reports.filter((r: any) => r.severity === 'critical').length,
      open: reports.filter((r: any) => r.status !== 'resolved').length,
    };
  }

  async createIncidentReport(dto: CreateIncidentReportDto) {
    const { data, error } = await this.db().from('incident_reports').insert({ title: dto.title, description: dto.description, severity: dto.severity, location: dto.location, disaster_id: dto.disasterId, reported_by: dto.reportedBy }).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateIncidentReport(id: string, dto: UpdateIncidentReportDto) {
    const { data, error } = await this.db().from('incident_reports').update(dto).eq('id', id).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteIncidentReport(id: string) {
    const { error } = await this.db().from('incident_reports').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Incident report deleted' };
  }

  // ─── Distributions ───────────────────────────────────────────────────────

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

  async createDistribution(dto: CreateDistributionDto) {
    const { data, error } = await this.db().from('distributions').insert({ operation_id: dto.operationId, citizen_id: dto.citizenId, family_id: dto.familyId, items: dto.items, date: dto.date }).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateDistribution(id: string, dto: UpdateDistributionDto) {
    const { data, error } = await this.db().from('distributions').update(dto).eq('id', id).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteDistribution(id: string) {
    const { error } = await this.db().from('distributions').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Distribution deleted' };
  }

  // ─── Registrations ───────────────────────────────────────────────────────

  async findCitizens(search?: string) {
    let query = this.db().from('registrations').select('*').eq('type', 'citizen').order('last_name', { ascending: true });
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createCitizen(dto: CreateCitizenDto) {
    const { data, error } = await this.db().from('registrations').insert({ ...dto, type: 'citizen' }).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateCitizen(id: string, dto: UpdateCitizenDto) {
    const { data, error } = await this.db().from('registrations').update(dto).eq('id', id).eq('type', 'citizen').select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteCitizen(id: string) {
    const { error } = await this.db().from('registrations').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Citizen deleted' };
  }

  async findFamilies(search?: string) {
    let query = this.db().from('families').select('*').order('created_at', { ascending: false });
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createFamily(dto: CreateFamilyDto) {
    const { data, error } = await this.db().from('families').insert({ first_name: dto.firstName, last_name: dto.lastName, head_user_id: dto.headUserId, relationship: dto.relationship, blood_type: dto.bloodType }).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateFamily(id: string, dto: UpdateFamilyDto) {
    const { data, error } = await this.db().from('families').update({ first_name: dto.firstName, last_name: dto.lastName, relationship: dto.relationship }).eq('id', id).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteFamily(id: string) {
    const { error } = await this.db().from('families').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Family record deleted' };
  }

  async getRegistrationStats() {
    const [citizens, families] = await Promise.all([
      this.db().from('registrations').select('id', { count: 'exact' }).eq('type', 'citizen'),
      this.db().from('families').select('id', { count: 'exact' }),
    ]);
    return { citizens: citizens.count ?? 0, families: families.count ?? 0 };
  }

  // ─── Check-ins ───────────────────────────────────────────────────────────

  async findCheckIns(search?: string) {
    let query = this.db().from('check_ins').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('notes', `%${search}%`);
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
      completed: checkIns.filter((c: any) => c.status === 'checked_out').length,
    };
  }

  async getRecentCheckIns(limit = 10) {
    const { data, error } = await this.db().from('check_ins').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  // ─── Uploads ─────────────────────────────────────────────────────────────

  async createDisasterCoverUploadUrl(dto: CreateDisasterCoverUploadDto) {
    const db = this.db();
    const bucket = process.env['SUPABASE_DISASTER_COVERS_BUCKET'] ?? 'disaster-covers';
    const objectPath = `${dto.disasterEventId}/${Date.now()}-${dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(objectPath);
    if (error) throw new BadRequestException(error.message);
    return { bucket, objectPath, signedUrl: data.signedUrl, token: data.token };
  }

  async createIncidentAttachmentUploadUrl(dto: CreateIncidentAttachmentUploadDto) {
    const db = this.db();
    const bucket = process.env['SUPABASE_INCIDENT_ATTACHMENTS_BUCKET'] ?? 'incident-attachments';
    const objectPath = `${dto.incidentReportId}/${Date.now()}-${dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(objectPath);
    if (error) throw new BadRequestException(error.message);
    return { bucket, objectPath, signedUrl: data.signedUrl, token: data.token };
  }

  async createObjectViewUrl(dto: CreateObjectViewUrlDto) {
    const { data, error } = await this.db().storage.from(dto.bucket).createSignedUrl(dto.objectPath, dto.expiresIn ?? 3600);
    if (error) throw new BadRequestException(error.message);
    return { signedUrl: data.signedUrl };
  }

  async broadcastWarning(dto: CreateWarningBroadcastDto) {
    const { data, error } = await this.db().from('drm_alerts').insert({ message: dto.message, severity: dto.severity ?? 'warning', disaster_id: dto.disasterId, type: 'broadcast' }).select().single();
    if (error) throw new BadRequestException(error.message);
    return { message: 'Warning broadcast sent', alert: data };
  }
}
