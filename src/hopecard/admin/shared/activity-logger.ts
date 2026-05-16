import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

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
  constructor(@Inject('ANALYTICS_SERVICE') private client: ClientProxy) {}

  async logActivity(data: ActivityLog) {
    try {
      await firstValueFrom(this.client.emit('log_activity', data));
      console.log(`[EVENT] Activity event emitted: ${data.action}`);
    } catch (error) {
      console.error('[EVENT] Failed to emit activity event:', error);
    }
  }
}
