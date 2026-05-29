import { Injectable } from '@nestjs/common';
import { supabase } from '@app/common/supabase-client';
import { ActivityLogger } from '@app/common/activity-logger';

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
  private readonly tableMap = {
    'Donor': 'digital_donor_profiles',
    'Beneficiary': 'beneficiary_profiles',
    'Campaign Manager': 'campaign_manager_profiles',
  };

  constructor(private readonly activityLogger: ActivityLogger) {}

  /**
   * Fetch all approved/active users with optional role filtering
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

      // Query each table
      for (const table of tablesToQuery) {
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact' })
          .in('status', ['approved', 'active'])
          .order('created_at', { ascending: false });

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

      // Sort all users by created_at and apply pagination
      const sortedUsers = allUsers.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

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
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const table = this.tableMap[role];
      if (!table) {
        return { success: false, message: 'Invalid role provided' };
      }

      // Fetch the user to get auth_user_id
      const { data: user, error: fetchError } = await supabase
        .from(table)
        .select('auth_user_id, status')
        .eq('id', userId)
        .single();

      if (fetchError || !user) {
        return { success: false, message: 'User not found' };
      }

      // Skip if status is not changing
      if (user.status === newStatus) {
        return {
          success: true,
          message: 'User status unchanged',
          data: user,
        };
      }

      // Update profile table
      const { data: updated, error: updateError } = await supabase
        .from(table)
        .update({
          status: newStatus,
          status_reason: reason,
          status_changed_at: new Date().toISOString(),
        })
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
          await supabase.auth.admin.signOut(user.auth_user_id, {
            scope: 'all',
          });
        } catch (sessionError) {
          console.warn('Warning: Could not invalidate sessions:', sessionError);
          // Don't fail the overall operation if session invalidation fails
        }
      }

      // Log the activity
      await this.activityLogger.log({
        adminId: null, // Will be set by controller
        action: 'status_update',
        description: `${newStatus === 'active' ? 'Reactivated' : newStatus === 'suspended' ? 'Suspended' : 'Banned'} user account`,
        resourceType: 'user',
        resourceId: userId,
        changes: {
          status: { from: user.status, to: newStatus },
          reason,
        },
      });

      return {
        success: true,
        message: `User account ${newStatus} successfully`,
        data: updated,
      };
    } catch (error) {
      console.error('Error in updateUserStatus:', error);
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  /**
   * Helper to map table name to role
   */
  private getRoleFromTable(
    table: string,
  ): 'Donor' | 'Beneficiary' | 'Campaign Manager' {
    const roleMap = {
      'digital_donor_profiles': 'Donor',
      'beneficiary_profiles': 'Beneficiary',
      'campaign_manager_profiles': 'Campaign Manager',
    };
    return roleMap[table] as any;
  }
}
