import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';

@Injectable()
export class NotificationsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  async findAll() {
    const { data, error } = await this.db.from('bh_notifications').select('*').eq('target_role', 'admin').order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async markAsRead(id: string) {
    const { data, error } = await this.db.from('bh_notifications').update({ is_read: true }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async clearAll() {
    const { error } = await this.db.from('bh_notifications').delete().eq('target_role', 'admin');
    if (error) throw error;
    return { success: true };
  }
}
