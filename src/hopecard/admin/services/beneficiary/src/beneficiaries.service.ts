import { Injectable } from '@nestjs/common';
import { supabase } from '@shared/supabaseClient';
import { ActivityLogger } from '@shared/activity-logger';

export interface Beneficiary {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  updated_at?: string;
  [key: string]: any;
}

@Injectable()
export class BeneficiariesService {
  constructor(private readonly activityService: ActivityLogger) {}
  async getAllBeneficiaries(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Beneficiary[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;

      // Get total count from hc_campaigns table
      const { count } = await supabase
        .from('hc_campaigns')
        .select('*', { count: 'exact', head: true });

      // Get paginated data from hc_campaigns
      const { data, error } = await supabase
        .from('hc_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('❌ Error fetching campaigns for beneficiaries list:', error);
        throw new Error(`Failed to fetch campaigns: ${error.message}`);
      }

      // Fetch manager names
      // 2. Get all manager profiles for these campaigns
      const managerIds = [...new Set(data?.map(c => c.created_by).filter(id => id))];
      let managersMap: Record<string, string> = {};
      
      if (managerIds.length > 0) {
        const { data: managers } = await supabase
          .from('campaign_manager_profiles')
          .select('id, auth_user_id, first_name, last_name, organization_name')
          .in('auth_user_id', managerIds);
          
        managersMap = (managers || []).reduce((acc, m) => {
          const name = (m.first_name ? `${m.first_name} ${m.last_name || ''}`.trim() : '');
          acc[m.auth_user_id] = name || m.organization_name || 'Unknown Manager';
          return acc;
        }, {} as Record<string, string>);
      }

      // 3. Get all linked beneficiaries via campaign_beneficiaries junction table
      const campaignIds = data?.map(c => c.id) || [];
      let beneficiariesMap: Record<string, { name: string, id: string }> = {};

      if (campaignIds.length > 0) {
        // Fetch from junction table
        const { data: junctionData } = await supabase
          .from('campaign_beneficiaries')
          .select('campaign_id, beneficiary_profile_id')
          .in('campaign_id', campaignIds);

        // Also fetch from direct campaign_id link in beneficiary_profiles
        const { data: directLinks } = await supabase
          .from('beneficiary_profiles')
          .select('id, first_name, last_name, campaign_id')
          .in('campaign_id', campaignIds);

        const beneficiaryProfileIds = [...new Set(junctionData?.map(j => j.beneficiary_profile_id).filter(id => id))];

        // Combine profile IDs from both sources
        const allProfileIds = [...new Set([
          ...beneficiaryProfileIds,
          ...(directLinks?.map(p => p.id) || [])
        ])];

        if (allProfileIds.length > 0) {
          // Fetch actual profile names for those in junction table (directLinks already has names)
          const { data: profiles } = await supabase
            .from('beneficiary_profiles')
            .select('id, first_name, last_name')
            .in('id', beneficiaryProfileIds);

          const profilesMap = (profiles || []).reduce((acc, p) => {
            acc[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown Beneficiary';
            return acc;
          }, {} as Record<string, string>);

          // Initialize beneficiaries map with direct links first
          if (directLinks) {
            directLinks.forEach(p => {
              if (p.campaign_id) {
                beneficiariesMap[p.campaign_id] = {
                  name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown Beneficiary',
                  id: p.id
                };
              }
            });
          }

          // Override/Add with junction data (usually junction table is the source of truth if both exist)
          (junctionData || []).forEach(j => {
            if (j.campaign_id && j.beneficiary_profile_id) {
              beneficiariesMap[j.campaign_id] = {
                name: profilesMap[j.beneficiary_profile_id] || 'Unknown Beneficiary',
                id: j.beneficiary_profile_id
              };
            }
          });
        }
      }

      // 4. Format the final data
      const formattedData = (data || []).map(campaign => {
        const beneficiaryInfo = beneficiariesMap[campaign.id];
        
        return {
          id: campaign.id, // Use campaign ID to ensure row uniqueness in the table
          beneficiary_id: beneficiaryInfo?.id, // Keep beneficiary ID for details routing
          first_name: beneficiaryInfo?.name || 'No Beneficiary Linked',
          last_name: '', // Combined in first_name
          campaign: campaign.title,
          campaign_manager_name: campaign.created_by ? managersMap[campaign.created_by] || 'Unknown Manager' : 'Unknown Manager',
          allocated_amount: campaign.collected_amount,
          status: this.mapCampaignStatusToBeneficiaryStatus(campaign.status),
          created_at: campaign.created_at,
        };
      });

      console.log(`✅ Retrieved ${formattedData.length} campaigns with resolved names`);

      return {
        data: formattedData as unknown as Beneficiary[],
        total: count || 0,
        page,
        limit,
      };
    } catch (error) {
      console.error('❌ Exception in getAllBeneficiaries:', error);
      return { data: [], total: 0, page, limit };
    }
  }

  /**
   * Helper to map campaign status to beneficiary status expected by frontend
   */
  private mapCampaignStatusToBeneficiaryStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'active': 'Active',
      'completed': 'Sent',
      'pending': 'Pending',
      'cancelled': 'Rejected'
    };
    return statusMap[status.toLowerCase()] || status;
  }

  async getBeneficiaryById(id: string): Promise<Beneficiary> {
    try {
      const { data, error } = await supabase
        .from('beneficiary_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ Error fetching beneficiary:', error);
        throw new Error(`Failed to fetch beneficiary: ${error.message}`);
      }

      if (!data) {
        console.warn(`⚠️ Beneficiary not found: ${id}`);
        throw new Error('Beneficiary not found');
      }

      console.log(`✅ Retrieved beneficiary: ${data.first_name} ${data.last_name}`);
      return data;
    } catch (error) {
      console.error('❌ Exception in getBeneficiaryById:', error);
      throw error;
    }
  }

  async getBeneficiariesByStatus(
    status: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Beneficiary[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;

      // Get total count for this status from beneficiary_profiles
      const { count } = await supabase
        .from('beneficiary_profiles')
        .select('*', { count: 'exact' })
        .eq('status', status);

      // Get paginated data
      const { data, error } = await supabase
        .from('beneficiary_profiles')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('❌ Error fetching beneficiaries by status:', error);
        throw new Error(`Failed to fetch beneficiaries: ${error.message}`);
      }

      console.log(`✅ Retrieved ${data?.length || 0} beneficiaries with status '${status}'`);
      return {
        data: data || [],
        total: count || 0,
        page,
        limit,
      };
    } catch (error) {
      console.error('❌ Exception in getBeneficiariesByStatus:', error);
      throw error;
    }
  }

  async searchBeneficiaries(
    query: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Beneficiary[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      const searchQuery = `%${query}%`;

      // Count total matching records from beneficiary_profiles
      const { count } = await supabase
        .from('beneficiary_profiles')
        .select('*', { count: 'exact' })
        .or(`first_name.ilike.${searchQuery},last_name.ilike.${searchQuery},email.ilike.${searchQuery}`);

      // Get paginated data
      const { data, error } = await supabase
        .from('beneficiary_profiles')
        .select('*')
        .or(`first_name.ilike.${searchQuery},last_name.ilike.${searchQuery},email.ilike.${searchQuery}`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('❌ Error searching beneficiaries:', error);
        throw new Error(`Failed to search beneficiaries: ${error.message}`);
      }

      console.log(`✅ Found ${data?.length || 0} beneficiaries matching '${query}'`);
      return {
        data: data || [],
        total: count || 0,
        page,
        limit,
      };
    } catch (error) {
      console.error('❌ Exception in searchBeneficiaries:', error);
      throw error;
    }
  }

  async createBeneficiary(beneficiaryData: Partial<Beneficiary>): Promise<Beneficiary> {
    try {
      const { data, error } = await supabase
        .from('beneficiary_profiles')
        .insert([beneficiaryData])
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating beneficiary:', error);
        throw new Error(`Failed to create beneficiary: ${error.message}`);
      }

      console.log(`✅ Created beneficiary: ${data.first_name} ${data.last_name}`);

      // Log activity when beneficiary applies (status is pending)
      if (data.verification_status === 'pending' || data.status === 'pending') {
        try {
          await this.activityService.logActivity({
            admin_id: 'system',
            admin_email: data.email,
            action: 'APPLIED',
            description: `New beneficiary application from ${data.first_name} ${data.last_name}`,
            resource_type: 'beneficiary',
            resource_id: data.id,
          });
        } catch (activityError) {
          console.warn('Failed to log activity for new beneficiary application:', activityError);
        }
      }

      return data;
    } catch (error) {
      console.error('❌ Exception in createBeneficiary:', error);
      throw error;
    }
  }

  async updateBeneficiary(
    id: string,
    updates: Partial<Beneficiary>,
  ): Promise<Beneficiary> {
    try {
      const { data, error } = await supabase
        .from('beneficiary_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating beneficiary:', error);
        throw new Error(`Failed to update beneficiary: ${error.message}`);
      }

      if (!data) {
        throw new Error('Beneficiary not found');
      }

      console.log(`✅ Updated beneficiary: ${data.first_name} ${data.last_name}`);
      return data;
    } catch (error) {
      console.error('❌ Exception in updateBeneficiary:', error);
      throw error;
    }
  }

  async deleteBeneficiary(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('beneficiary_profiles')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Error deleting beneficiary:', error);
        throw new Error(`Failed to delete beneficiary: ${error.message}`);
      }

      console.log(`✅ Deleted beneficiary: ${id}`);
      return { success: true, message: 'Beneficiary deleted successfully' };
    } catch (error) {
      console.error('❌ Exception in deleteBeneficiary:', error);
      throw error;
    }
  }
}
