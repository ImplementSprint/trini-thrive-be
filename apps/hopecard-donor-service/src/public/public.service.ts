import { Injectable, NotFoundException } from '@nestjs/common';
import { supabaseRequest } from '@app/common/supabase-helpers';
import { getStorageUrl } from '@app/common/storage';

const CAMPAIGN_SELECT =
  'id,title,description,category,target_amount,collected_amount,cover_image_key,status,end_date';

interface DbCampaignRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  target_amount: number;
  collected_amount: number;
  cover_image_key: string | null;
  status: string;
  end_date: string | null;
}

function formatCampaign(row: DbCampaignRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    category: row.category ?? 'other',
    target_amount: Number(row.target_amount),
    collected_amount: Number(row.collected_amount),
    progress_pct:
      row.target_amount > 0
        ? Math.min(
            100,
            Math.round(
              (Number(row.collected_amount) / Number(row.target_amount)) * 100,
            ),
          )
        : 0,
    cover_image_url: getStorageUrl('campaigns', row.cover_image_key),
    end_date: row.end_date ?? null,
  };
}

@Injectable()
export class PublicService {
  async getCampaigns(category?: string, search?: string) {
    let query = `hc_campaigns?status=eq.active&select=${CAMPAIGN_SELECT}&order=created_at.desc`;
    if (category) query += `&category=eq.${encodeURIComponent(category)}`;
    if (search) query += `&title=ilike.${encodeURIComponent(`*${search}*`)}`;

    const rows = await supabaseRequest<DbCampaignRow[]>(query);
    return { campaigns: rows.map(formatCampaign) };
  }

  async getCampaign(id: string) {
    const rows = await supabaseRequest<DbCampaignRow[]>(
      `hc_campaigns?id=eq.${encodeURIComponent(id)}&status=eq.active&select=${CAMPAIGN_SELECT}&limit=1`,
    );
    if (rows.length === 0) throw new NotFoundException('Campaign not found');
    return { campaign: formatCampaign(rows[0]!) };
  }
}
