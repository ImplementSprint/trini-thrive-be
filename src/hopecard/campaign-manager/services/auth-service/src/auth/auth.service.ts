import {
  Injectable,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class AuthService implements OnModuleInit {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseKey) {
      console.error(
        '❌ ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing',
      );
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getManagerProfile(authUserId: string) {
    const { data, error } = await this.supabase
      .from('campaign_manager_profiles')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async getBeneficiaryProfiles(status?: string) {
    let query = this.supabase.from('beneficiary_profiles').select('*');

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }
}
