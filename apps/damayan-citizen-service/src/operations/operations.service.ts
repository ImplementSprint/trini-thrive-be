import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';

function generateQrCodeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

@Injectable()
export class OperationsService {
  private readonly logger = new Logger(OperationsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private db() {
    const client = this.supabaseService.getClient();
    if (!client) throw new Error('Supabase client not initialized');
    return client as any;
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const { data, error } = await this.db()
      .from('citizens')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateMedical(userId: string, bloodType?: string, medicalConditions?: string) {
    const updates: Record<string, unknown> = {};
    if (bloodType !== undefined) updates['blood_type'] = bloodType;
    if (medicalConditions !== undefined) updates['medical_conditions'] = medicalConditions;

    const { data, error } = await this.db()
      .from('citizens')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  async register(userId: string, body: any) {
    const qrCodeId = generateQrCodeId('CIT');
    const { data, error } = await this.db()
      .from('citizens')
      .insert({ ...body, user_id: userId, qr_code_id: qrCodeId })
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Family ───────────────────────────────────────────────────────────────

  async getFamily(userId: string) {
    const { data, error } = await this.db()
      .from('family_members')
      .select('*')
      .eq('head_user_id', userId);
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async addFamily(userId: string, body: any) {
    const { data, error } = await this.db()
      .from('family_members')
      .insert({ ...body, head_user_id: userId })
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateFamily(id: string, body: any) {
    const { data, error } = await this.db()
      .from('family_members')
      .update(body)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Family member ${id} not found`);
    return data;
  }

  async deleteFamilyMember(id: string) {
    const { error } = await this.db().from('family_members').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  async deleteFamilyByQr(qrCodeId: string) {
    const { data: citizen } = await this.db()
      .from('citizens')
      .select('id')
      .eq('qr_code_id', qrCodeId)
      .maybeSingle();
    if (!citizen) return { ok: true };
    const { error } = await this.db().from('family_members').delete().eq('citizen_id', citizen.id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  // ─── Animals ──────────────────────────────────────────────────────────────

  async getAnimals(userId: string) {
    const { data, error } = await this.db()
      .from('animals')
      .select('*')
      .eq('user_id', userId);
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async addAnimal(userId: string, body: any) {
    const { data, error } = await this.db()
      .from('animals')
      .insert({ ...body, user_id: userId })
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteAnimals(userId: string) {
    const { error } = await this.db().from('animals').delete().eq('user_id', userId);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  // ─── Family Group ─────────────────────────────────────────────────────────

  async getFamilyGroup(userId: string) {
    const { data, error } = await this.db()
      .from('family_groups')
      .select('*, family_group_members(*)')
      .eq('head_user_id', userId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createFamilyGroup(userId: string, familyName?: string) {
    const familyQrCodeId = generateQrCodeId('FAM');
    const { data, error } = await this.db()
      .from('family_groups')
      .insert({ head_user_id: userId, family_qr_code_id: familyQrCodeId, family_name: familyName })
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async addFamilyGroupMember(userId: string, citizenQrCodeId: string, relationship?: string) {
    const group = await this.getFamilyGroup(userId);
    if (!group) throw new BadRequestException('Create a family group first before adding members');

    const { data: citizen } = await this.db()
      .from('citizens')
      .select('id')
      .eq('qr_code_id', citizenQrCodeId)
      .maybeSingle();
    if (!citizen) throw new NotFoundException('Citizen not found for QR code');

    const { data, error } = await this.db()
      .from('family_group_members')
      .insert({ family_group_id: group.id, citizen_id: citizen.id, relationship })
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async removeFamilyGroupMember(userId: string, qrCodeId: string) {
    const group = await this.getFamilyGroup(userId);
    if (!group) return { ok: true };
    const { data: citizen } = await this.db()
      .from('citizens')
      .select('id')
      .eq('qr_code_id', qrCodeId)
      .maybeSingle();
    if (!citizen) return { ok: true };
    await this.db()
      .from('family_group_members')
      .delete()
      .eq('family_group_id', group.id)
      .eq('citizen_id', citizen.id);
    return { ok: true };
  }

  async deleteFamilyGroup(userId: string) {
    await this.db().from('family_groups').delete().eq('head_user_id', userId);
    return { ok: true };
  }

  // ─── Citizen Lookup ───────────────────────────────────────────────────────

  async lookupCitizen(qrCode: string) {
    const { data, error } = await this.db()
      .from('citizens')
      .select('*')
      .eq('qr_code_id', qrCode)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ?? null;
  }

  // ─── Incident Report ──────────────────────────────────────────────────────

  async createIncidentReport(userId: string, body: any) {
    const { data: activeDisaster } = await this.db()
      .from('disaster_events')
      .select('id')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeDisaster) throw new BadRequestException('No active disaster event found');

    const { data, error } = await this.db()
      .from('incident_reports')
      .insert({
        ...body,
        reported_by: userId,
        disaster_id: body.disasterId ?? activeDisaster.id,
      })
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
