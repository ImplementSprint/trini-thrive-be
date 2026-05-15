import { Injectable } from '@nestjs/common';
import { supabase } from '@shared/supabaseClient';
import { ActivityLogger } from '@shared/activity-logger';

export interface BeneficiaryApproval {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  status: string;
  created_at: string;
  [key: string]: any;
}

@Injectable()
export class BeneficiaryApprovalsService {
  constructor(private readonly activityService: ActivityLogger) {}

  /**
   * Get all beneficiary approvals from beneficiary_profiles table
   */
  async getAllApprovals(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: BeneficiaryApproval[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;

      // Get total count (all statuses)
      const { count } = await supabase
        .from('beneficiary_profiles')
        .select('*', { count: 'exact' });

      // Get paginated beneficiaries
      const { data, error } = await supabase
        .from('beneficiary_profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Supabase error fetching pending approvals:', error);
        return { data: [], total: 0, page, limit };
      }

      console.log('✅ Pending beneficiary approvals:', count);
      
      // Fetch user emails from auth.users for beneficiaries that don't have email
      const beneficiariesWithEmail = await Promise.all(
        (data || []).map(async (beneficiary) => {
          const mappedBeneficiary = {
            ...beneficiary,
            documents_submitted: !!beneficiary.id_verification_key,
            bank_details_submitted: !!(beneficiary.bank_name && beneficiary.account_number),
          };

          if (beneficiary.email) {
            return mappedBeneficiary;
          }
          
          if (beneficiary.auth_user_id) {
            const { data: authUser } = await supabase
              .from('auth.users')
              .select('email')
              .eq('id', beneficiary.auth_user_id)
              .single();
            
            if (authUser?.email) {
              return { ...mappedBeneficiary, email: authUser.email };
            }
          }
          return mappedBeneficiary;
        })
      );
      
      return { data: beneficiariesWithEmail || [], total: count || 0, page, limit };
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      return { data: [], total: 0, page, limit };
    }
  }

  /**
   * Approve a beneficiary application from beneficiary_profiles table
   */
  async approveBeneficiary(
    beneficiaryId: string,
    adminId: string,
    adminEmail?: string,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Get beneficiary name for activity log
      const { data: beneficiaryData } = await supabase
        .from('beneficiary_profiles')
        .select('first_name, last_name')
        .eq('id', beneficiaryId)
        .single();

      const { data, error } = await supabase
        .from('beneficiary_profiles')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', beneficiaryId)
        .select();

      if (error) {
        console.error('Supabase error approving beneficiary:', error);
        return { success: false, message: 'Failed to approve beneficiary' };
      }

      // Log activity
      try {
        await this.activityService.logActivity({
          admin_id: adminId,
          admin_email: adminEmail || 'admin@hopecard.com',
          action: 'APPROVED',
          description: `Approved beneficiary application: ${beneficiaryData?.first_name} ${beneficiaryData?.last_name}`,
          resource_type: 'beneficiary',
          resource_id: beneficiaryId,
        });
      } catch (activityError) {
        console.warn('Failed to log activity, but approval succeeded:', activityError);
      }

      console.log('✅ Beneficiary approved:', beneficiaryId);
      return {
        success: true,
        message: 'Beneficiary approved successfully',
        data: data?.[0],
      };
    } catch (error) {
      console.error('Error approving beneficiary:', error);
      return { success: false, message: 'Error approving beneficiary' };
    }
  }

  /**
   * Reject a beneficiary application from beneficiary_profiles table
   */
  async rejectBeneficiary(
    beneficiaryId: string,
    adminId: string,
    reason?: string,
    adminEmail?: string,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Get beneficiary name for activity log
      const { data: beneficiaryData } = await supabase
        .from('beneficiary_profiles')
        .select('first_name, last_name')
        .eq('id', beneficiaryId)
        .single();

      const { data, error } = await supabase
        .from('beneficiary_profiles')
        .update({
          status: 'rejected',
          rejection_reason: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', beneficiaryId)
        .select();

      if (error) {
        console.error('Supabase error rejecting beneficiary:', error);
        return { success: false, message: 'Failed to reject beneficiary' };
      }

      // Log activity
      try {
        await this.activityService.logActivity({
          admin_id: adminId,
          admin_email: adminEmail || 'admin@hopecard.com',
          action: 'REJECTED',
          description: `Rejected beneficiary application: ${beneficiaryData?.first_name} ${beneficiaryData?.last_name}${reason ? ` - Reason: ${reason}` : ''}`,
          resource_type: 'beneficiary',
          resource_id: beneficiaryId,
        });
      } catch (activityError) {
        console.warn('Failed to log activity, but rejection succeeded:', activityError);
      }

      console.log('✅ Beneficiary rejected:', beneficiaryId);
      return {
        success: true,
        message: 'Beneficiary rejected successfully',
        data: data?.[0],
      };
    } catch (error) {
      console.error('Error rejecting beneficiary:', error);
      return { success: false, message: 'Error rejecting beneficiary' };
    }
  }

  /**
   * Get approval history for a beneficiary from beneficiary_profiles table
   */
  async getApprovalHistory(beneficiaryId: string): Promise<{ status: string; verified_by?: string; verified_at?: string; rejection_reason?: string }> {
    try {
      const { data, error } = await supabase
        .from('beneficiary_profiles')
        .select('status')
        .eq('id', beneficiaryId)
        .single();

      if (error) {
        console.error('Error fetching approval history:', error);
        return { status: 'unknown' };
      }

      return {
        status: data?.status || 'unknown',
      };
    } catch (error) {
      console.error('Error fetching approval history:', error);
      return { status: 'unknown' };
    }
  }

  /**
   * Send/process a donation to a beneficiary
   */
  async sendDonation(
    beneficiaryId: string,
    adminId: string,
    donationData: {
      amount: number;
      campaign?: string;
      notes?: string;
    },
    adminEmail?: string,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Get beneficiary details for logging
      const { data: beneficiaryData } = await supabase
        .from('beneficiary_profiles')
        .select('first_name, last_name, email, allocated_amount')
        .eq('id', beneficiaryId)
        .single();

      if (!beneficiaryData) {
        return { success: false, message: 'Beneficiary not found' };
      }

      // Insert donation record into hopecard_purchases table
      const { data, error } = await supabase
        .from('hopecard_purchases')
        .insert([
          {
            beneficiary_id: beneficiaryId,
            amount_paid: donationData.amount,
            campaign: donationData.campaign || 'General Aid',
            notes: donationData.notes || '',
            processed_by: adminId,
            processed_at: new Date().toISOString(),
            status: 'completed',
          },
        ])
        .select();

      if (error) {
        console.error('Supabase error creating donation record:', error);
        return { success: false, message: 'Failed to record donation' };
      }

      // Log activity
      try {
        await this.activityService.logActivity({
          admin_id: adminId,
          admin_email: adminEmail || 'admin@hopecard.com',
          action: 'DONATION_SENT',
          description: `Sent donation of ₱${donationData.amount} to ${beneficiaryData.first_name} ${beneficiaryData.last_name}`,
          resource_type: 'donation',
          resource_id: beneficiaryId,
        });
      } catch (activityError) {
        console.warn('Failed to log activity, but donation was recorded:', activityError);
      }

      console.log('✅ Donation recorded for beneficiary:', beneficiaryId);
      return {
        success: true,
        message: 'Donation sent successfully',
        data: data?.[0],
      };
    } catch (error) {
      console.error('Error sending donation:', error);
      return { success: false, message: 'Error processing donation' };
    }
  }

  /**
   * Approve a beneficiary's documents
   */
  async approveDocument(
    beneficiaryId: string,
    adminId: string,
    adminEmail?: string,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Get name for logging
      const { data: beneficiaryData } = await supabase
        .from('beneficiary_profiles')
        .select('first_name, last_name')
        .eq('id', beneficiaryId)
        .single();

      const { data, error } = await supabase
        .from('beneficiary_identity_documents')
        .update({
          status: 'approved',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('beneficiary_profile_id', beneficiaryId)
        .select();

      if (error) {
        console.error('Supabase error approving beneficiary document:', error);
        return { success: false, message: 'Failed to approve beneficiary documents' };
      }

      await this.activityService.logActivity({
        admin_id: adminId,
        admin_email: adminEmail || 'admin@hopecard.com',
        action: 'APPROVED_DOCUMENTS',
        description: `Approved documents for beneficiary: ${beneficiaryData?.first_name} ${beneficiaryData?.last_name}`,
        resource_type: 'beneficiary_document',
        resource_id: beneficiaryId,
      });

      console.log('✅ Beneficiary documents approved in beneficiary_identity_documents:', beneficiaryId);
      return {
        success: true,
        message: 'Beneficiary documents approved successfully',
        data: data?.[0],
      };
    } catch (error) {
      console.error('Error approving beneficiary documents:', error);
      return { success: false, message: 'Error approving beneficiary documents' };
    }
  }

  /**
   * Reject a beneficiary's documents
   */
  async rejectDocument(
    beneficiaryId: string,
    adminId: string,
    reason?: string,
    adminEmail?: string,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Get name for logging
      const { data: beneficiaryData } = await supabase
        .from('beneficiary_profiles')
        .select('first_name, last_name')
        .eq('id', beneficiaryId)
        .single();

      const { data, error } = await supabase
        .from('beneficiary_identity_documents')
        .update({
          status: 'rejected',
          rejection_reason: reason || null,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('beneficiary_profile_id', beneficiaryId)
        .select();

      if (error) {
        console.error('Supabase error rejecting beneficiary documents:', error);
        return { success: false, message: 'Failed to reject beneficiary documents' };
      }

      await this.activityService.logActivity({
        admin_id: adminId,
        admin_email: adminEmail || 'admin@hopecard.com',
        action: 'REJECTED_DOCUMENTS',
        description: `Rejected documents for beneficiary: ${beneficiaryData?.first_name} ${beneficiaryData?.last_name}${reason ? ` - Reason: ${reason}` : ''}`,
        resource_type: 'beneficiary_document',
        resource_id: beneficiaryId,
      });

      console.log('✅ Beneficiary documents rejected in beneficiary_identity_documents:', beneficiaryId);
      return {
        success: true,
        message: 'Beneficiary documents rejected successfully',
        data: data?.[0],
      };
    } catch (error) {
      console.error('Error rejecting beneficiary documents:', error);
      return { success: false, message: 'Error rejecting beneficiary documents' };
    }
  }

  /**
   * Approve a beneficiary's bank details
   */
  async approveBank(
    beneficiaryId: string,
    adminId: string,
    adminEmail?: string,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Get name for logging
      const { data: beneficiaryData } = await supabase
        .from('beneficiary_profiles')
        .select('first_name, last_name')
        .eq('id', beneficiaryId)
        .single();

      const { data, error } = await supabase
        .from('beneficiary_bank_accounts')
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('beneficiary_profile_id', beneficiaryId)
        .select();

      if (error) {
        console.error('Supabase error approving beneficiary bank details:', error);
        return { success: false, message: 'Failed to approve beneficiary bank details' };
      }

      await this.activityService.logActivity({
        admin_id: adminId,
        admin_email: adminEmail || 'admin@hopecard.com',
        action: 'APPROVED_BANK',
        description: `Approved bank details for beneficiary: ${beneficiaryData?.first_name} ${beneficiaryData?.last_name}`,
        resource_type: 'beneficiary_bank',
        resource_id: beneficiaryId,
      });

      console.log('✅ Beneficiary bank details approved in beneficiary_bank_accounts:', beneficiaryId);
      return {
        success: true,
        message: 'Beneficiary bank details approved successfully',
        data: data?.[0],
      };
    } catch (error) {
      console.error('Error approving beneficiary bank details:', error);
      return { success: false, message: 'Error approving beneficiary bank details' };
    }
  }

  /**
   * Reject a beneficiary's bank details
   */
  async rejectBank(
    beneficiaryId: string,
    adminId: string,
    reason?: string,
    adminEmail?: string,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Get name for logging
      const { data: beneficiaryData } = await supabase
        .from('beneficiary_profiles')
        .select('first_name, last_name')
        .eq('id', beneficiaryId)
        .single();

      const { data, error } = await supabase
        .from('beneficiary_bank_accounts')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('beneficiary_profile_id', beneficiaryId)
        .select();

      if (error) {
        console.error('Supabase error rejecting beneficiary bank details:', error);
        return { success: false, message: 'Failed to reject beneficiary bank details' };
      }

      await this.activityService.logActivity({
        admin_id: adminId,
        admin_email: adminEmail || 'admin@hopecard.com',
        action: 'REJECTED_BANK',
        description: `Rejected bank details for beneficiary: ${beneficiaryData?.first_name} ${beneficiaryData?.last_name}${reason ? ` - Reason: ${reason}` : ''}`,
        resource_type: 'beneficiary_bank',
        resource_id: beneficiaryId,
      });

      console.log('✅ Beneficiary bank details rejected in beneficiary_bank_accounts:', beneficiaryId);
      return {
        success: true,
        message: 'Beneficiary bank details rejected successfully',
        data: data?.[0],
      };
    } catch (error) {
      console.error('Error rejecting beneficiary bank details:', error);
      return { success: false, message: 'Error rejecting beneficiary bank details' };
    }
  }

  /**
   * Get all identity document approvals
   */
  async getDocumentApprovals(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;

      const { count } = await supabase
        .from('beneficiary_identity_documents')
        .select('*', { count: 'exact', head: true });

      const { data, error } = await supabase
        .from('beneficiary_identity_documents')
        .select(`
          *,
          beneficiary_profiles (
            first_name,
            last_name,
            email,
            hc_campaigns (
              title
            )
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching document approvals:', error);
        return { data: [], total: 0, page, limit };
      }

      const formattedData = (data || []).map(doc => {
        const profile = doc.beneficiary_profiles as any;
        return {
          ...doc,
          beneficiary_name: profile
            ? `${profile.first_name} ${profile.last_name}`.trim()
            : 'Unknown Beneficiary',
          beneficiary_email: profile?.email || 'No Email',
          campaign_title: profile?.hc_campaigns?.title || 'N/A',
        };
      });

      return { data: formattedData, total: count || 0, page, limit };
    } catch (error) {
      console.error('Exception in getDocumentApprovals:', error);
      return { data: [], total: 0, page, limit };
    }
  }

  /**
   * Get all bank account approvals
   */
  async getBankApprovals(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;

      const { count } = await supabase
        .from('beneficiary_bank_accounts')
        .select('*', { count: 'exact', head: true });

      const { data, error } = await supabase
        .from('beneficiary_bank_accounts')
        .select(`
          *,
          beneficiary_profiles (
            first_name,
            last_name,
            email,
            hc_campaigns (
              title
            )
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching bank approvals:', error);
        return { data: [], total: 0, page, limit };
      }

      const formattedData = (data || []).map(bank => {
        const profile = bank.beneficiary_profiles as any;
        return {
          ...bank,
          beneficiary_name: profile
            ? `${profile.first_name} ${profile.last_name}`.trim()
            : 'Unknown Beneficiary',
          beneficiary_email: profile?.email || 'No Email',
          campaign_title: profile?.hc_campaigns?.title || 'N/A',
          status: bank.is_active ? 'approved' : 'pending',
        };
      });

      return { data: formattedData, total: count || 0, page, limit };
    } catch (error) {
      console.error('Exception in getBankApprovals:', error);
      return { data: [], total: 0, page, limit };
    }
  }
}
