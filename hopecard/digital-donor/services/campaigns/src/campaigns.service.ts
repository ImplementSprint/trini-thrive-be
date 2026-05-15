import { Injectable } from '@nestjs/common';
import { supabaseRequest } from '@shared/supabase';
import { getStorageUrl } from '@shared/storage';
import { DbCampaign } from '@shared/types';

@Injectable()
export class CampaignsService {
  async getCampaigns(category?: string) {
    let query = 'hc_campaigns?status=eq.active&select=id,title,description,category,target_amount,collected_amount,cover_image_key,status,end_date&order=created_at.desc';
    if (category) query += `&category=eq.${encodeURIComponent(category)}`;

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
}
