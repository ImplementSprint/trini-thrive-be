import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';
import { CreateDonationDto, FilterDonorsDto, UpdateDonationDto } from './dto/donors.dto';

@Injectable()
export class DonorsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  async findAll(filters: FilterDonorsDto) {
    let query = this.db.from('donations').select('*').order('donated_at', { ascending: false });
    if (filters.campaign_id) query = query.eq('campaign_id', filters.campaign_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) query = query.or(`message.ilike.%${filters.search}%,transaction_ref.ilike.%${filters.search}%`);

    const { data: donations, error } = await query;
    if (error) throw error;
    if (!donations?.length) return [];

    const donorIds = [...new Set(donations.map((d) => d.donor_auth_id).filter(Boolean))];
    const campaignIds = [...new Set(donations.map((d) => d.campaign_id).filter(Boolean))];

    const [profilesRes, campaignsRes] = await Promise.all([
      donorIds.length ? this.db.from('user_profiles').select('auth_user_id, first_name, last_name, phone, profile_photo_key').in('auth_user_id', donorIds) : Promise.resolve({ data: [] }),
      campaignIds.length ? this.db.from('bh_campaigns').select('id, title, type, status').in('id', campaignIds) : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map((p: Record<string, unknown>) => [p['auth_user_id'], p]));
    const campaignMap = new Map((campaignsRes.data ?? []).map((c: Record<string, unknown>) => [c['id'], c]));

    return donations.map((d) => ({
      ...d,
      user_profiles: profileMap.get(d.donor_auth_id) ?? null,
      bh_campaigns: campaignMap.get(d.campaign_id) ?? null,
    }));
  }

  async findOne(id: string) {
    const { data: donation, error } = await this.db.from('donations').select('*').eq('id', id).single();
    if (error) throw error;

    const [profileRes, campaignRes] = await Promise.all([
      donation.donor_auth_id ? this.db.from('user_profiles').select('*').eq('auth_user_id', donation.donor_auth_id).maybeSingle() : Promise.resolve({ data: null }),
      donation.campaign_id ? this.db.from('bh_campaigns').select('*').eq('id', donation.campaign_id).single() : Promise.resolve({ data: null }),
    ]);

    return { ...donation, user_profiles: profileRes.data, bh_campaigns: campaignRes.data };
  }

  async create(dto: CreateDonationDto) {
    const { data, error } = await this.db.from('donations').insert({
      campaign_id: dto.campaign_id ?? null,
      donor_auth_id: dto.donor_auth_id ?? null,
      donation_type: dto.donation_type ?? 'goods',
      item_name: dto.item_name ?? null,
      quantity: dto.quantity ?? 0,
      unit: dto.unit ?? null,
      condition: dto.condition ?? null,
      amount: dto.amount ?? 0,
      currency: dto.currency ?? 'PHP',
      payment_method: dto.payment_method ?? null,
      transaction_ref: dto.transaction_ref ?? null,
      hopecard_id: dto.hopecard_id ?? null,
      message: dto.message ?? null,
      anonymous: dto.anonymous ?? false,
      status: dto.status ?? 'pending',
    }).select().single();
    if (error) throw error;
    return data;
  }

  async update(id: string, dto: UpdateDonationDto) {
    const { data: existing, error: fetchErr } = await this.db.from('donations').select('*').eq('id', id).single();
    if (fetchErr || !existing) throw new NotFoundException('Donation not found');

    const updateData: Record<string, unknown> = {};
    Object.entries(dto).forEach(([k, v]) => { if (v !== undefined) updateData[k] = v; });

    const { data, error } = await this.db.from('donations').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    if (!data) throw new NotFoundException('Donation not found');

    if (dto.status && dto.status !== existing.status) {
      try {
        await this.db.from('bh_notifications').insert({
          user_id: existing.donor_auth_id,
          target_role: 'donor',
          title: 'Donation Pledge Updated',
          message: `Your donation pledge status has been updated to ${dto.status}.`,
          type: 'donation_pledge_review',
          reference_id: id,
        });
      } catch (e) {}
    }

    if (dto.status === 'confirmed' && existing.status !== 'confirmed' && existing.campaign_id) {
      const { data: campaign } = await this.db.from('bh_campaigns').select('id, current_amount').eq('id', existing.campaign_id).single();
      if (campaign) {
        await this.db.from('bh_campaigns').update({ current_amount: Number(campaign.current_amount ?? 0) + Number(existing.quantity ?? 0) }).eq('id', campaign.id);
      }
    }

    return data;
  }

  async remove(id: string) {
    const { error } = await this.db.from('donations').delete().eq('id', id);
    if (error) throw error;
    return { deleted: true };
  }
}
