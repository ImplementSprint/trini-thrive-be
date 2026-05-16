import {
  Injectable,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CampaignsService implements OnModuleInit {
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

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

    if (!this.configService.get<string>('NOTIFICATION_SERVICE_URL')) {
      console.warn(
        '⚠️  WARNING: NOTIFICATION_SERVICE_URL is not set — falling back to ' +
          'http://localhost:3003. Campaign creation emails will fail in ' +
          'non-local environments.',
      );
    }
  }

  async create(dto: any) {
    const {
      title,
      category,
      description,
      target_amount,
      end_date,
      cover_image_key,
      created_by,
      beneficiaryIds,
    } = dto;

    const { data: campaign, error: insertError } = await this.supabase
      .from('hc_campaigns')
      .insert({
        title: title || 'Untitled Campaign',
        category: category?.toLowerCase() || null,
        description: description || null,
        cover_image_key,
        target_amount,
        end_date,
        status: 'draft',
        created_by,
        start_date: new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new InternalServerErrorException(
        'Failed to create campaign record.',
      );
    }

    if (beneficiaryIds && beneficiaryIds.length > 0) {
      const joinRows = beneficiaryIds.map((id) => ({
        campaign_id: campaign.id,
        beneficiary_profile_id: id,
      }));

      const { error: joinError } = await this.supabase
        .from('campaign_beneficiaries')
        .insert(joinRows);

      if (joinError) {
        console.error('Beneficiary link error:', joinError);
      }

      // Trigger emails via Notification Service
      const { data: beneficiaries } = await this.supabase
        .from('beneficiary_profiles')
        .select('email, first_name, last_name')
        .in('id', beneficiaryIds);

      const notificationServiceUrl =
        this.configService.get<string>('NOTIFICATION_SERVICE_URL') ||
        'http://localhost:3003';

      for (const b of beneficiaries || []) {
        if (!b.email) continue;
        try {
          await firstValueFrom(
            this.httpService.post(
              `${notificationServiceUrl}/notifications/send-email`,
              {
                to: b.email,
                subject: 'You have been invited to a new HopeCard Campaign!',
                html: `
                <div style="font-family: sans-serif; text-align: center; color: #333;">
                  <h2 style="color: #b55247;">Hello ${b.first_name || 'Beneficiary'},</h2>
                  <p>You have been selected as a beneficiary for a newly created campaign on HopeCard.</p>
                  <p>Please log in to your dashboard to view the details and confirm your participation.</p>
                </div>
              `,
              },
            ),
          );
        } catch (mailError) {
          console.error(
            `Failed to trigger email for ${b.email}`,
            mailError.message,
          );
        }
      }
    }

    return campaign;
  }

  async findAll() {
    const { data, error } = await this.supabase
      .from('hc_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        `Could not fetch from Supabase: ${error.message}`,
      );
    }

    return data.map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      beneficiary: campaign.beneficiary || 'Not specified',
      raised: campaign.collected_amount || 0,
      goal: campaign.target_amount || 0,
      donors: campaign.donor_count || 0,
      endDate: campaign.end_date || 'TBD',
      status: this.mapStatus(campaign.status),
    }));
  }

  private mapStatus(dbStatus: string): 'Active' | 'Pending' | 'Completed' {
    if (dbStatus === 'active') return 'Active';
    if (dbStatus === 'draft') return 'Pending';
    if (dbStatus === 'completed') return 'Completed';
    return 'Pending';
  }
}
