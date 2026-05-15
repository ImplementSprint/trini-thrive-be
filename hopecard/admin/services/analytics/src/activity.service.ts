import { Injectable } from '@nestjs/common';
import { supabase } from '@shared/supabaseClient';

export interface Activity {
  id?: string;
  admin_id: string;
  admin_email: string;
  action: string;
  description: string;
  resource_type: string;
  resource_id?: string;
  changes?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
}

@Injectable()
export class ActivityService {
  async logActivity(activity: Activity): Promise<Activity> {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .insert([
          {
            admin_id: activity.admin_id,
            admin_email: activity.admin_email,
            action: activity.action,
            description: activity.description,
            resource_type: activity.resource_type,
            resource_id: activity.resource_id || null,
            changes: activity.changes || null,
            ip_address: activity.ip_address || null,
            user_agent: activity.user_agent || null,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('❌ Error logging activity:', error);
        throw new Error(`Failed to log activity: ${error.message}`);
      }

      console.log(`✅ Activity logged: ${activity.action} on ${activity.resource_type}`);
      return data;
    } catch (error) {
      console.error('❌ Exception in logActivity:', error);
      throw error;
    }
  }

  async getActivityLog(
    page: number = 1,
    limit: number = 20,
    filters?: {
      admin_id?: string;
      action?: string;
      resource_type?: string;
      date_from?: string;
      date_to?: string;
    },
  ): Promise<{ data: Activity[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;

      let query = supabase.from('activity_logs').select('*', { count: 'exact' });

      // Apply filters
      if (filters?.admin_id) {
        query = query.eq('admin_id', filters.admin_id);
      }
      if (filters?.action) {
        query = query.eq('action', filters.action);
      }
      if (filters?.resource_type) {
        query = query.eq('resource_type', filters.resource_type);
      }
      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      // Get count
      const { count } = await query;

      // Get paginated data
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('❌ Error fetching activity logs:', error);
        throw new Error(`Failed to fetch activity logs: ${error.message}`);
      }

      console.log(`✅ Retrieved ${data?.length || 0} activity logs from ${count || 0} total`);
      return {
        data: data || [],
        total: count || 0,
        page,
        limit,
      };
    } catch (error) {
      console.error('❌ Exception in getActivityLog:', error);
      throw error;
    }
  }

  async getActivityByAdmin(
    adminId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: Activity[]; total: number; page: number; limit: number }> {
    try {
      return this.getActivityLog(page, limit, { admin_id: adminId });
    } catch (error) {
      console.error('❌ Exception in getActivityByAdmin:', error);
      throw error;
    }
  }

  async getActivityByResourceType(
    resourceType: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: Activity[]; total: number; page: number; limit: number }> {
    try {
      return this.getActivityLog(page, limit, { resource_type: resourceType });
    } catch (error) {
      console.error('❌ Exception in getActivityByResourceType:', error);
      throw error;
    }
  }

  async getActivityByAction(
    action: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: Activity[]; total: number; page: number; limit: number }> {
    try {
      return this.getActivityLog(page, limit, { action });
    } catch (error) {
      console.error('❌ Exception in getActivityByAction:', error);
      throw error;
    }
  }

  async getRecentActivity(hours: number = 24): Promise<Activity[]> {
    try {
      const dateFrom = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .gte('created_at', dateFrom)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Error fetching recent activity:', error);
        throw new Error(`Failed to fetch recent activity: ${error.message}`);
      }

      console.log(`✅ Retrieved ${data?.length || 0} activities from last ${hours} hours`);
      return data || [];
    } catch (error) {
      console.error('❌ Exception in getRecentActivity:', error);
      throw error;
    }
  }

  async deleteOldActivities(daysToKeep: number = 90): Promise<{ deleted: number }> {
    try {
      const dateThreshold = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

      const { count, error } = await supabase
        .from('activity_logs')
        .delete()
        .lt('created_at', dateThreshold);

      if (error) {
        console.error('❌ Error deleting old activities:', error);
        throw new Error(`Failed to delete old activities: ${error.message}`);
      }

      console.log(`✅ Deleted ${count || 0} activities older than ${daysToKeep} days`);
      return { deleted: count || 0 };
    } catch (error) {
      console.error('❌ Exception in deleteOldActivities:', error);
      throw error;
    }
  }
}
