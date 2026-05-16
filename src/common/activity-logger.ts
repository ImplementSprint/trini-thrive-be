import { Injectable } from '@nestjs/common';
import { ActivityService } from '../analytics/activity.service';

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
  constructor(private readonly activityService: ActivityService) {}

  async logActivity(data: ActivityLog) {
    try {
      await this.activityService.logActivity(data);
      console.log(`[ACTIVITY] Logged: ${data.action}`);
    } catch (error) {
      console.error('[ACTIVITY] Failed to log activity:', error);
    }
  }
}
