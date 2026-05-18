import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      this.client = createClient(url, key);
    }
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client
        .from('beneficiary_profiles')
        .select('id')
        .limit(1);
      return !error;
    } catch {
      return false;
    }
  }
}
