import { Injectable } from '@nestjs/common';
import { supabase } from '@shared/supabaseClient';

export interface Campaign {
  id: string;
  title: string;
  description: string;
  target_amount: number;
  collected_amount: number;
  status: string;
  created_at: string;
  created_by: string;
  campaign_manager_name?: string;
  [key: string]: any;
}

@Injectable()
export class CampaignsService {
  async getAllCampaigns(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Campaign[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;

      const { count } = await supabase
        .from('hc_campaigns')
        .select('*', { count: 'exact', head: true });

      const { data, error } = await supabase
        .from('hc_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('❌ Error fetching campaigns:', error);
        throw new Error(`Failed to fetch campaigns: ${error.message}`);
      }

      // Fetch manager names
      const managerIds = [...new Set(data?.map(c => c.created_by).filter(id => id))];
      let managersMap: Record<string, string> = {};
      
      if (managerIds.length > 0) {
        const { data: managers } = await supabase
          .from('campaign_manager_profiles')
          .select('id, auth_user_id, first_name, last_name, organization_name')
          .in('auth_user_id', managerIds);
          
        if (managers) {
          managersMap = managers.reduce((acc, m) => {
            const name = (m.first_name ? `${m.first_name} ${m.last_name || ''}`.trim() : '');
            acc[m.auth_user_id] = name || m.organization_name || 'Unknown Manager';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const formattedData = (data || []).map(campaign => ({
        ...campaign,
        campaign_manager_name: campaign.created_by ? managersMap[campaign.created_by] || 'Unknown Manager' : 'Unknown Manager',
      }));

      return {
        data: formattedData,
        total: count || 0,
        page,
        limit,
      };
    } catch (error) {
      console.error('Exception in getAllCampaigns:', error);
      throw error;
    }
  }
}
