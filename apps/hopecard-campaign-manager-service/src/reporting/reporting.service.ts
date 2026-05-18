import {
  Injectable,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class ReportingService implements OnModuleInit {
  private supabase!: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseKey) {
      console.error(
        '❌ ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing',
      );
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getDashboardData(authUserId: string) {
    // Logic from app/actions/reports.ts -> getDashboardData
    // ... implementation ...
    try {
      const { data: managerProfile } = await this.supabase
        .from('campaign_manager_profiles')
        .select('first_name, last_name')
        .eq('auth_user_id', authUserId)
        .single();

      const managerName = managerProfile
        ? `${managerProfile.first_name} ${managerProfile.last_name}`
        : 'Manager';

      const { data: campaigns } = await this.supabase
        .from('hc_campaigns')
        .select(
          'id, title, status, collected_amount, target_amount, end_date, cover_image_key, created_at',
        )
        .eq('created_by', authUserId)
        .order('created_at', { ascending: false });

      const campaignList = campaigns ?? [];
      const campaignIds = campaignList.map((c) => c.id);

      const fundsRaised = campaignList.reduce(
        (sum, c) => sum + Number(c.collected_amount ?? 0),
        0,
      );
      const activeCampaigns = campaignList.filter(
        (c) => c.status === 'active',
      ).length;
      const pendingActions = campaignList.filter(
        (c) => c.status === 'draft',
      ).length;

      let totalDonors = 0;
      let liveActivity: any[] = [];

      if (campaignIds.length > 0) {
        const { data: hopecards } = await this.supabase
          .from('hopecards')
          .select('id, campaign_id')
          .in('campaign_id', campaignIds);

        const hopecardIds = (hopecards ?? []).map((h) => h.id);
        const hopecardCampaignMap = Object.fromEntries(
          (hopecards ?? []).map((h) => [h.id, h.campaign_id]),
        );
        const campaignTitleMap = Object.fromEntries(
          campaignList.map((c) => [c.id, c.title]),
        );

        if (hopecardIds.length > 0) {
          const { data: purchases } = await this.supabase
            .from('hopecard_purchases')
            .select(
              'id, buyer_auth_id, amount_paid, purchased_at, hopecard_id, status',
            )
            .in('hopecard_id', hopecardIds)
            .eq('status', 'paid')
            .order('purchased_at', { ascending: false });

          const purchaseList = purchases ?? [];
          totalDonors = new Set(purchaseList.map((p) => p.buyer_auth_id)).size;

          const recent = purchaseList.slice(0, 5);
          const buyerIds = recent.map((p) => p.buyer_auth_id);

          const { data: donors } = await this.supabase
            .from('digital_donor_profiles')
            .select('auth_user_id, first_name, last_name')
            .in('auth_user_id', buyerIds);

          const donorMap = Object.fromEntries(
            (donors ?? []).map((d) => [
              d.auth_user_id,
              `${d.first_name} ${d.last_name}`,
            ]),
          );

          liveActivity = recent.map((p) => ({
            donorName: donorMap[p.buyer_auth_id] ?? 'Anonymous',
            amount: Number(p.amount_paid),
            campaignTitle:
              campaignTitleMap[hopecardCampaignMap[p.hopecard_id]] ??
              'Unknown Campaign',
            purchasedAt: p.purchased_at,
          }));
        }
      }

      return {
        metrics: {
          fundsRaised,
          activeCampaigns,
          totalDonors,
          pendingActions,
          managerName,
        },
        campaigns: campaignList.slice(0, 5).map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          collectedAmount: Number(c.collected_amount ?? 0),
          targetAmount: Number(c.target_amount ?? 0),
          endDate: c.end_date,
          coverImageKey: c.cover_image_key,
          createdAt: c.created_at,
        })),
        liveActivity,
      };
    } catch (error) {
      throw new InternalServerErrorException((error instanceof Error ? error.message : String(error)));
    }
  }

  // Other reporting methods (getMyCampaigns, getDonorsData, getReportsData)
  // ...
}
