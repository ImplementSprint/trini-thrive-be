import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';
import { FilterCampaignsDto, UpdateCampaignDto } from './dto/campaigns.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  async findAll(filters: FilterCampaignsDto) {
    let query = this.db.from('bh_campaigns').select('*').order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.org_id) query = query.eq('org_id', filters.org_id);
    if (filters.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);

    const { data: campaigns, error } = await query;
    if (error) throw error;
    if (!campaigns?.length) return [];

    const orgIds = [...new Set(campaigns.map((c) => c.org_id).filter(Boolean))];
    const campaignIds = campaigns.map((c) => c.id);

    const [orgsRes, rolesRes] = await Promise.all([
      orgIds.length
        ? this.db.from('organizations').select('id, name, type, address, verified').in('id', orgIds)
        : Promise.resolve({ data: [] }),
      campaignIds.length
        ? this.db.from('volunteer_roles').select('id, title, slots_total, slots_filled, location, start_date, end_date, status, campaign_id').in('campaign_id', campaignIds)
        : Promise.resolve({ data: [] }),
    ]);

    const orgMap = new Map((orgsRes.data ?? []).map((o: Record<string, unknown>) => [o['id'], o]));
    const rolesGrouped = new Map<string, unknown[]>();
    for (const r of rolesRes.data ?? []) {
      const arr = rolesGrouped.get((r as Record<string, unknown>)['campaign_id'] as string) ?? [];
      arr.push(r);
      rolesGrouped.set((r as Record<string, unknown>)['campaign_id'] as string, arr);
    }

    return campaigns.map((c) => ({
      ...c,
      organizations: orgMap.get(c.org_id) ?? null,
      volunteer_roles: rolesGrouped.get(c.id) ?? [],
    }));
  }

  async findOne(id: string) {
    const { data: campaign, error } = await this.db.from('bh_campaigns').select('*').eq('id', id).single();
    if (error) throw error;
    if (!campaign) throw new NotFoundException('Campaign not found');

    const [orgRes, rolesRes, donationsRes] = await Promise.all([
      campaign.org_id
        ? this.db.from('organizations').select('*').eq('id', campaign.org_id).single()
        : Promise.resolve({ data: null }),
      this.db.from('volunteer_roles').select('*').eq('campaign_id', id),
      this.db.from('donations').select('*').eq('campaign_id', id).order('donated_at', { ascending: false }),
    ]);

    return {
      ...campaign,
      organizations: orgRes.data ?? null,
      volunteer_roles: rolesRes.data ?? [],
      donations: donationsRes.data ?? [],
    };
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData['title'] = dto.title;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.type !== undefined) updateData['type'] = dto.type;
    if (dto.target_amount !== undefined) updateData['target_amount'] = dto.target_amount;
    if (dto.status !== undefined) updateData['status'] = dto.status;

    const { error } = await this.db.from('bh_campaigns').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    return this.findOne(id);
  }

  async remove(id: string) {
    const { error } = await this.db.from('bh_campaigns').delete().eq('id', id);
    if (error) throw error;
    return { deleted: true };
  }

  async getStats() {
    const [totalRes, activeRes, sumRes] = await Promise.all([
      this.db.from('bh_campaigns').select('*', { count: 'exact', head: true }),
      this.db.from('bh_campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      this.db.from('bh_campaigns').select('current_amount'),
    ]);

    const totalRaised = (sumRes.data ?? []).reduce((sum, c) => sum + Number(c.current_amount ?? 0), 0);

    return {
      total_campaigns: totalRes.count ?? 0,
      active_campaigns: activeRes.count ?? 0,
      total_raised: totalRaised,
    };
  }
}
