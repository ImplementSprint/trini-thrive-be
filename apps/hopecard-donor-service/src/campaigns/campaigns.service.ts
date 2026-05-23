import { Injectable, HttpException } from '@nestjs/common';
import { supabaseRequest } from '@app/common/supabase-helpers';
import { getStorageUrl } from '@app/common/storage';
import { DbCampaign } from '@app/common/types';

@Injectable()
export class CampaignsService {
  async getCampaigns(category?: string, search?: string) {
    let query = 'hc_campaigns?status=eq.active&select=id,title,description,category,target_amount,collected_amount,cover_image_key,status,end_date&order=created_at.desc';
    if (category) query += `&category=eq.${encodeURIComponent(category)}`;
    if (search) query += `&title=ilike.${encodeURIComponent(`*${search}*`)}`;

    const rows = await supabaseRequest<DbCampaign[]>(query);

    const campaigns = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      category: row.category ?? 'other',
      target_amount: Number(row.target_amount),
      collected_amount: Number(row.collected_amount),
      progress_pct: row.target_amount > 0
        ? Math.min(100, Math.round((Number(row.collected_amount) / Number(row.target_amount)) * 100))
        : 0,
      cover_image_url: getStorageUrl('campaigns', row.cover_image_key),
      status: row.status,
      end_date: row.end_date,
    }));

    return { campaigns };
  }

  async getCampaignById(id: string) {
    const query = `hc_campaigns?id=eq.${id}&select=id,title,description,category,target_amount,collected_amount,cover_image_key,status,end_date&limit=1`;
    const rows = await supabaseRequest<DbCampaign[]>(query);
    const row = rows[0];
    if (!row) throw new HttpException('Campaign not found', 404);
    return {
      campaign: {
        id: row.id,
        title: row.title,
        description: row.description ?? '',
        category: row.category ?? 'other',
        target_amount: Number(row.target_amount),
        collected_amount: Number(row.collected_amount),
        progress_pct: row.target_amount > 0
          ? Math.min(100, Math.round((Number(row.collected_amount) / Number(row.target_amount)) * 100))
          : 0,
        cover_image_url: getStorageUrl('campaigns', row.cover_image_key),
        status: row.status,
        end_date: row.end_date,
      }
    };
  }
}
