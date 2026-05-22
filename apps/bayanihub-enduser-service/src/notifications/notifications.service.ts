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

  async findAll(userId: string) {
    const [userRes, roleRes] = await Promise.all([
      this.db.from('bh_notifications').select('*').eq('user_id', userId),
      this.db.from('bh_notifications').select('*').is('user_id', null).in('target_role', ['volunteer', 'donor']),
    ]);

    if (userRes.error) throw userRes.error;
    if (roleRes.error) throw roleRes.error;

    const merged = [...(userRes.data ?? []), ...(roleRes.data ?? [])];
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return merged;
  }

  async markAsRead(id: string) {
    const { data, error } = await this.db
      .from('bh_notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async clearAll(userId: string) {
    const { error } = await this.db.from('bh_notifications').delete().eq('user_id', userId);
    if (error) throw error;
    return { success: true };
  }
}
