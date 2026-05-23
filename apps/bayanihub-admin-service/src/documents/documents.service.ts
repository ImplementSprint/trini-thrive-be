import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';

@Injectable()
export class DocumentsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  async getSignedUrl(bucket: string, key: string, expiresIn = 3600) {
    const cleanKey = this.normalizeKey(bucket, key);
    const { data, error } = await this.db.storage.from(bucket).createSignedUrl(cleanKey, expiresIn);
    if (error) throw error;
    if (!data?.signedUrl) throw new NotFoundException('Document not found');
    return { signed_url: data.signedUrl };
  }

  async getApplicationDocument(applicationId: string) {
    const { data: application, error } = await this.db.from('volunteer_applications').select('resume_key').eq('id', applicationId).single();
    if (error || !application) throw new NotFoundException('Application not found');
    if (!application.resume_key) return { signed_url: null, message: 'No document uploaded' };
    if (/^https?:\/\//i.test(application.resume_key as string)) return { signed_url: application.resume_key };
    return this.getSignedUrl('volunteer-documents', application.resume_key as string);
  }

  async getProfilePhoto(authUserId: string) {
    const { data: profile, error } = await this.db.from('user_profiles').select('profile_photo_key').eq('auth_user_id', authUserId).single();
    if (error || !profile) throw new NotFoundException('User profile not found');
    if (!profile.profile_photo_key) return { signed_url: null, message: 'No profile photo uploaded' };
    return this.getSignedUrl('profile-photos', profile.profile_photo_key as string);
  }

  async getCampaignCover(campaignId: string) {
    const { data: campaign, error } = await this.db.from('bh_campaigns').select('cover_image_key').eq('id', campaignId).single();
    if (error || !campaign) throw new NotFoundException('Campaign not found');
    if (!campaign.cover_image_key) return { signed_url: null, message: 'No cover image uploaded' };
    return this.getSignedUrl('campaign-covers', campaign.cover_image_key as string);
  }

  async listFiles(bucket: string, folder?: string) {
    const { data, error } = await this.db.storage.from(bucket).list(folder ?? '', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw error;
    return data;
  }

  private normalizeKey(bucket: string, key: string): string {
    const withoutUrl = key.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign)\//i, '');
    const prefix = `${bucket}/`;
    return withoutUrl.startsWith(prefix) ? withoutUrl.slice(prefix.length) : withoutUrl;
  }
}
