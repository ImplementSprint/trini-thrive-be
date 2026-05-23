import { Injectable } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';

@Injectable()
export class HealthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getHealth() {
    const database = await this.supabaseService.ping();

    return {
      status: database ? 'ok' : 'degraded',
      service: 'beneficiary-health-service',
      timestamp: new Date().toISOString(),
      checks: { database },
    };
  }
}
