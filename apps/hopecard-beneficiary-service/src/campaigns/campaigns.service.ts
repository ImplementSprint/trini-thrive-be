import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { ProcedureEventService } from '@app/api-center';

type SbError = { message: string; code?: string } | null;

interface ProfileRow {
  id: string;
}

interface EnrollmentRow {
  campaign_id: string;
}

interface CampaignRow {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  target_amount: string;
  collected_amount: string;
  created_by?: string | null;
}

interface InvitationRow {
  id: string;
  campaign_id: string;
  status: string;
  invited_at: string;
  responded_at: string | null;
  hc_campaigns: {
    title?: string;
    description?: string;
    category?: string;
    status?: string;
    target_amount?: string;
    collected_amount?: string;
  } | null;
}

interface ManagerProfileRow {
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  email: string | null;
  phone: string | null;
}

interface InvitationStatusRow {
  id: string;
  campaign_id: string;
  status: string;
}

@Injectable()
export class CampaignsService {
  constructor(private readonly events: ProcedureEventService) {}
  private get admin() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  private async getProfile(authUserId: string) {
    const { data, error } = (await this.admin
      .from('beneficiary_profiles')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single()) as { data: ProfileRow | null; error: SbError };
    if (error || !data)
      throw new NotFoundException('Beneficiary profile not found');
    return data;
  }

  async getCampaigns(authUserId: string) {
    const profile = await this.getProfile(authUserId);

    const { data: enrollments } = (await this.admin
      .from('campaign_beneficiaries')
      .select('campaign_id')
      .eq('beneficiary_profile_id', profile.id)) as {
      data: EnrollmentRow[] | null;
      error: SbError;
    };

    const { count: pendingInvitations } = await this.admin
      .from('campaign_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('beneficiary_profile_id', profile.id)
      .eq('status', 'pending');

    const campaignIds = (enrollments ?? []).map((e) => e.campaign_id);
    if (campaignIds.length === 0) {
      return {
        campaigns: [],
        summary: {
          total_support: 0,
          active_count: 0,
          pending_invitations: pendingInvitations ?? 0,
        },
      };
    }

    const { data: campaigns, error } = (await this.admin
      .from('hc_campaigns')
      .select(
        'id, title, description, category, status, target_amount, collected_amount',
      )
      .in('id', campaignIds)) as {
      data: CampaignRow[] | null;
      error: SbError;
    };

    if (error) throw new BadRequestException(error.message);

    const activeCount = (campaigns ?? []).filter(
      (c) => c.status === 'active',
    ).length;
    const totalSupport = (campaigns ?? []).reduce(
      (sum, c) => sum + Number(c.collected_amount),
      0,
    );

    return {
      campaigns: (campaigns ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        status: c.status,
        target_amount: Number(c.target_amount),
        collected_amount: Number(c.collected_amount),
        total_received: Number(c.collected_amount),
      })),
      summary: {
        total_support: totalSupport,
        active_count: activeCount,
        pending_invitations: pendingInvitations ?? 0,
      },
    };
  }

  async getCampaign(authUserId: string, campaignId: string) {
    const profile = await this.getProfile(authUserId);
    const { data: enrollment } = (await this.admin
      .from('campaign_beneficiaries')
      .select('campaign_id')
      .eq('beneficiary_profile_id', profile.id)
      .eq('campaign_id', campaignId)
      .single()) as { data: EnrollmentRow | null; error: SbError };
    if (!enrollment) throw new NotFoundException('Campaign not found');

    const { data: campaign, error } = (await this.admin
      .from('hc_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()) as { data: CampaignRow | null; error: SbError };
    if (error || !campaign) throw new NotFoundException('Campaign not found');

    // Resolve campaign manager via created_by → campaign_manager_profiles.auth_user_id
    let manager = null;
    if (campaign.created_by) {
      const { data: mgr } = (await this.admin
        .from('campaign_manager_profiles')
        .select('first_name, last_name, organization_name, email, phone')
        .eq('auth_user_id', campaign.created_by)
        .maybeSingle()) as { data: ManagerProfileRow | null; error: SbError };
      if (mgr) {
        manager = {
          full_name:
            `${mgr.first_name ?? ''} ${mgr.last_name ?? ''}`.trim() || null,
          organization_name: mgr.organization_name ?? null,
          email: mgr.email ?? null,
          phone: mgr.phone ?? null,
        };
      }
    }

    return {
      campaign,
      manager,
      disbursements: [],
      total_received: Number(campaign.collected_amount ?? 0),
    };
  }

  async getInvitations(authUserId: string) {
    const profile = await this.getProfile(authUserId);
    const { data, error } = (await this.admin
      .from('campaign_invitations')
      .select(
        '*, hc_campaigns(id, title, description, category, status, target_amount, collected_amount)',
      )
      .eq('beneficiary_profile_id', profile.id)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false })) as {
      data: InvitationRow[] | null;
      error: SbError;
    };
    if (error) throw new BadRequestException(error.message);

    const invitations = (data ?? []).map((inv) => {
      const campaign = inv.hc_campaigns ?? {};
      return {
        id: inv.id,
        campaign_id: inv.campaign_id,
        status: inv.status,
        invited_at: inv.invited_at,
        responded_at: inv.responded_at,
        // flatten campaign fields for the frontend
        title: campaign.title ?? null,
        description: campaign.description ?? null,
        category: campaign.category ?? null,
        campaign_status: campaign.status ?? null,
        target_amount: Number(campaign.target_amount ?? 0),
        collected_amount: Number(campaign.collected_amount ?? 0),
      };
    });

    return { invitations };
  }

  async acceptInvitation(authUserId: string, invitationId: string) {
    const profile = await this.getProfile(authUserId);
    const { data: invitation } = (await this.admin
      .from('campaign_invitations')
      .select('id, campaign_id, status')
      .eq('id', invitationId)
      .eq('beneficiary_profile_id', profile.id)
      .single()) as { data: InvitationStatusRow | null; error: SbError };
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'pending')
      throw new ConflictException('Invitation already responded to');

    const { error: enrollError } = (await this.admin
      .from('campaign_beneficiaries')
      .insert({
        campaign_id: invitation.campaign_id,
        beneficiary_profile_id: profile.id,
      })) as { error: SbError };
    if (enrollError && enrollError.code !== '23505')
      throw new BadRequestException(enrollError.message);

    void (await this.admin
      .from('campaign_invitations')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', invitationId));

    this.events.emit(
      'hopecard.beneficiary.invitation_accepted',
      {
        authUserId,
        beneficiaryProfileId: profile.id,
        invitationId,
        campaignId: invitation.campaign_id,
      },
      {
        partitionKey: profile.id,
        sourceServiceId: 'hopecard-beneficiary-service',
      },
    );

    return { success: true };
  }

  async declineInvitation(authUserId: string, invitationId: string) {
    const profile = await this.getProfile(authUserId);
    const { data: invitation } = (await this.admin
      .from('campaign_invitations')
      .select('id, status')
      .eq('id', invitationId)
      .eq('beneficiary_profile_id', profile.id)
      .single()) as {
      data: { id: string; status: string } | null;
      error: SbError;
    };
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'pending')
      throw new ConflictException('Invitation already responded to');

    void (await this.admin
      .from('campaign_invitations')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', invitationId));

    this.events.emit(
      'hopecard.beneficiary.invitation_declined',
      { authUserId, beneficiaryProfileId: profile.id, invitationId },
      {
        partitionKey: profile.id,
        sourceServiceId: 'hopecard-beneficiary-service',
      },
    );

    return { success: true };
  }
}
