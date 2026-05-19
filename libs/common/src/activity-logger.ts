import { Injectable } from '@nestjs/common';
import { supabase } from './supabase-client';

export interface ActivityLog {
  admin_id: string;
  admin_email: string;
  action: string;
  description: string;
  resource_type: string;
  resource_id?: string;
}

@Injectable()
export class ActivityLogger {
  async logActivity(data: ActivityLog) {
    try {
      await supabase.from('activity_logs').insert([
        {
          admin_id: data.admin_id,
          admin_email: data.admin_email,
          action: data.action,
          description: data.description,
          resource_type: data.resource_type,
          resource_id: data.resource_id ?? null,
          created_at: new Date().toISOString(),
        },
      ]);
      console.log(`[ACTIVITY] Logged: ${data.action}`);
    } catch (error) {
      console.error('[ACTIVITY] Failed to log activity:', error);
    }
  }
}
