import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';
import * as QRCode from 'qrcode';
import { GenerateQrDto } from './dto/generate-qr.dto';

@Injectable()
export class QrService {
  private readonly BUCKET = 'qr-codes';

  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  async generate(dto: GenerateQrDto, generatedByUserId: string | null) {
    if (!dto.application_id && !dto.donation_id) {
      throw new BadRequestException('Either application_id or donation_id must be provided');
    }

    let payload: unknown;
    let fileName = '';
    const dbRecord: Record<string, unknown> = { qr_type: dto.qr_type, generated_by: generatedByUserId, campaign_id: dto.campaign_id ?? null };

    if (dto.application_id) {
      const { data: application, error: appErr } = await this.db.from('volunteer_applications').select('id, status, volunteer_auth_id, role_id').eq('id', dto.application_id).single();
      if (appErr || !application) throw new NotFoundException('Application not found');
      if (application.status !== 'approved') throw new BadRequestException('QR codes can only be generated for approved applications');

      const [profileRes, roleRes] = await Promise.all([
        this.db.from('user_profiles').select('auth_user_id, first_name, last_name, phone, address, barangay, municipality, province').eq('auth_user_id', application.volunteer_auth_id).single(),
        this.db.from('volunteer_roles').select('id, title, campaign_id, location, start_date, end_date').eq('id', application.role_id).single(),
      ]);

      if (!profileRes.data) throw new NotFoundException('Volunteer profile not found');
      const profile = profileRes.data;
      const volRole = roleRes.data;

      let campaign = null;
      const campaignId = dto.campaign_id ?? volRole?.campaign_id;
      if (campaignId) {
        const { data } = await this.db.from('bh_campaigns').select('id, title').eq('id', campaignId).single();
        campaign = data;
        dbRecord['campaign_id'] = campaignId;
      }

      payload = {
        type: dto.qr_type,
        application_id: application.id,
        volunteer: { name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(), phone: profile.phone ?? '' },
        role: volRole?.title ?? 'Volunteer',
        campaign: campaign ? { id: (campaign as Record<string, unknown>)['id'], title: (campaign as Record<string, unknown>)['title'] } : null,
        issued_at: new Date().toISOString(),
      };

      dbRecord['application_id'] = application.id;
      dbRecord['volunteer_auth_id'] = application.volunteer_auth_id;
      fileName = `${dto.qr_type}_app_${application.id}_${Date.now()}.png`;

    } else if (dto.donation_id) {
      const { data: donation, error: donErr } = await this.db.from('donations').select('id, donor_auth_id, campaign_id, item_name, quantity, unit').eq('id', dto.donation_id).single();
      if (donErr || !donation) throw new NotFoundException('Donation not found');

      payload = {
        type: 'drop_off',
        donation_id: donation.id,
        donation_details: { item: donation.item_name ?? 'Donation Item', quantity: donation.quantity ?? 1, unit: donation.unit ?? 'pcs' },
        issued_at: new Date().toISOString(),
      };

      dbRecord['donation_id'] = donation.id;
      dbRecord['donor_auth_id'] = donation.donor_auth_id;
      fileName = `drop_off_don_${donation.id}_${Date.now()}.png`;
    }

    const filePath = `${dto.qr_type}/${fileName}`;

    const qrBuffer = await QRCode.toBuffer(JSON.stringify(payload), { type: 'png', width: 400, margin: 2, errorCorrectionLevel: 'M' });

    const { error: uploadErr } = await this.db.storage.from(this.BUCKET).upload(filePath, qrBuffer, { contentType: 'image/png', upsert: true });
    if (uploadErr) throw new BadRequestException(`Failed to upload QR code: ${uploadErr.message}`);

    const { data: urlData } = this.db.storage.from(this.BUCKET).getPublicUrl(filePath);

    dbRecord['payload'] = payload;
    dbRecord['storage_path'] = filePath;
    dbRecord['public_url'] = urlData.publicUrl;

    const { data: qrRecord, error: insertErr } = await this.db.from('qr_codes').insert(dbRecord).select().single();
    if (insertErr) throw new BadRequestException(`Failed to save QR record: ${insertErr.message}`);

    return { id: qrRecord.id, qr_type: dto.qr_type, public_url: urlData.publicUrl, payload, generated_at: qrRecord.created_at };
  }

  async findByApplication(applicationId: string) {
    const { data, error } = await this.db.from('qr_codes').select('*').eq('application_id', applicationId).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async findByDonation(donationId: string) {
    const { data, error } = await this.db.from('qr_codes').select('*').eq('donation_id', donationId).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async findOne(id: string) {
    const { data, error } = await this.db.from('qr_codes').select('*').eq('id', id).single();
    if (error) throw error;
    if (!data) throw new NotFoundException('QR code not found');
    return data;
  }
}
