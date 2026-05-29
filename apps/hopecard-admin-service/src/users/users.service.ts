import { Injectable } from '@nestjs/common';
import { supabase } from '@app/common/supabase-client';
import { ActivityLogger } from '@app/common/activity-logger';
import { sendAccountStatusEmail, sendAccountReactivationEmail } from '@app/common/email';

export interface UserProfile {
  id: string;
  auth_user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'Donor' | 'Beneficiary' | 'Campaign Manager';
  status: string;
  created_at: string;
}

export interface GetUsersResponse {
  data: UserProfile[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class UsersService {
  private readonly tableMap: Record<string, string> = {
    'Donor': 'digital_donor_profiles',
    'Beneficiary': 'beneficiary_profiles',
    'Campaign Manager': 'campaign_manager_profiles',
  };

  constructor(private readonly activityLogger: ActivityLogger) {}

  /**
   * Fetch all approved/active users with optional role filtering
   * IMPORTANT: Pagination must be applied AFTER combining results from all tables
   * to avoid broken pagination across multiple tables
   */
  async getAllUsers(
    page: number = 1,
    limit: number = 10,
    roleFilter?: string,
  ): Promise<GetUsersResponse> {
    try {
      const offset = (page - 1) * limit;

      // Determine which tables to query
      const tablesToQuery =
        roleFilter && this.tableMap[roleFilter]
          ? [this.tableMap[roleFilter]]
          : Object.values(this.tableMap);

      const allUsers: any[] = [];
      let totalCount = 0;

      // Query each table WITHOUT pagination (get all matching records)
      for (const table of tablesToQuery) {
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact' })
          .in('status', ['approved', 'active', 'suspended', 'banned'])
          .order('created_at', { ascending: false });
        // NOTE: Removed .range() - we want all records from each table to combine properly

        if (error) {
          console.error(`Error fetching from ${table}:`, error);
          continue;
        }

        totalCount += count || 0;
        if (data) {
          allUsers.push(
            ...data.map((user) => ({
              ...user,
              role: this.getRoleFromTable(table),
            })),
          );
        }
      }

      // Sort all users by created_at (combining results from multiple tables)
      const sortedUsers = allUsers.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      // Apply pagination AFTER combining and sorting
      const paginatedUsers = sortedUsers.slice(offset, offset + limit);

      // Map to response format
      const formattedUsers: UserProfile[] = paginatedUsers.map((user) => ({
        id: user.id,
        auth_user_id: user.auth_user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
      }));

      return {
        data: formattedUsers,
        total: totalCount,
        page,
        limit,
      };
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw error;
    }
  }

  /**
   * Update user status and invalidate sessions
   */
  async updateUserStatus(
    userId: string,
    newStatus: 'active' | 'suspended' | 'banned',
    reason: string,
    role: string,
    adminId: string = 'unknown',
    expiresAt: string | null = null,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const table = this.tableMap[role];
      if (!table) {
        return { success: false, message: 'Invalid role provided' };
      }

      // Fetch the user to get auth_user_id and contact details
      const { data: user, error: fetchError } = await supabase
        .from(table)
        .select('auth_user_id, status, email, first_name')
        .eq('id', userId)
        .single();

      if (fetchError || !user) {
        return {
          success: false,
          message: `User not found: ID ${userId} in ${table}`
        };
      }

      // Skip if status is not changing
      if (user.status === newStatus) {
        return {
          success: true,
          message: 'User status unchanged',
          data: user,
        };
      }

      // Build update object with expiration handling
      const updateData: any = {
        status: newStatus,
        status_reason: reason,
        status_changed_at: new Date().toISOString(),
      };

      // Only set status_expires_at if provided (for suspensions/bans)
      if (expiresAt) {
        updateData.status_expires_at = expiresAt;
      } else if (newStatus === 'active') {
        // Clear expiration when reactivating
        updateData.status_expires_at = null;
      }

      // Update profile table
      const { data: updated, error: updateError } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        return { success: false, message: `Failed to update user: ${updateError.message}` };
      }

      // Invalidate Supabase sessions if suspending or banning
      if (newStatus === 'suspended' || newStatus === 'banned') {
        try {
          // Sign out the user from all sessions
          await supabase.auth.admin.signOut(user.auth_user_id, 'global');
        } catch (sessionError) {
          console.warn('Warning: Could not invalidate sessions:', sessionError);
          // Don't fail the overall operation if session invalidation fails
        }
      }

      // Notify the user by email on status change
      if (user.email) {
        if (newStatus === 'suspended' || newStatus === 'banned') {
          sendAccountStatusEmail(user.email, {
            firstName: user.first_name || 'User',
            status: newStatus,
            reason,
            expiresAt,
          }).catch((emailErr) =>
            console.warn('[EMAIL] Non-fatal: failed to send account status email:', emailErr),
          );
        } else if (newStatus === 'active') {
          sendAccountReactivationEmail(user.email, {
            firstName: user.first_name || 'User',
            previousStatus: user.status,
            reason,
          }).catch((emailErr) =>
            console.warn('[EMAIL] Non-fatal: failed to send reactivation email:', emailErr),
          );
        }
      }

      // Log the activity with adminId
      await this.activityLogger.logActivity({
        admin_id: adminId,
        admin_email: 'admin@system', // Email not available from request, using system default
        action: 'status_update',
        description: `${newStatus === 'active' ? 'Reactivated' : newStatus === 'suspended' ? 'Suspended' : 'Banned'} user account. Reason: ${reason}`,
        resource_type: 'user',
        resource_id: userId,
      });

      return {
        success: true,
        message: `User account ${newStatus} successfully`,
        data: updated,
      };
    } catch (error) {
      console.error('Error in updateUserStatus:', error);
      return { success: false, message: `Error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Helper to map table name to role
   */
  private getRoleFromTable(
    table: string,
  ): 'Donor' | 'Beneficiary' | 'Campaign Manager' {
    const roleMap: Record<string, 'Donor' | 'Beneficiary' | 'Campaign Manager'> = {
      'digital_donor_profiles': 'Donor',
      'beneficiary_profiles': 'Beneficiary',
      'campaign_manager_profiles': 'Campaign Manager',
    };
    return roleMap[table] || 'Donor';  // Default to 'Donor' if not found
  }
}
