import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { sendConfirmationEmail } from '@app/common/email';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import { ProcedureEventService } from '@app/api-center';

@Injectable()
export class AuthService implements OnModuleInit {
  private supabase!: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly events: ProcedureEventService,
  ) {}

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

  private static readonly ALLOWED_DOC_TYPES: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
  };

  private static readonly MAX_DOC_BYTES = 5 * 1024 * 1024; // 5 MB

  async register(
    body: { email: string; password: string; firstName: string; lastName: string; organization: string; contactNumber?: string },
    files: { secRegistration?: Express.Multer.File[]; orgCertificate?: Express.Multer.File[] },
  ): Promise<{ success: boolean; message: string }> {
    const { email, password, firstName, lastName, organization, contactNumber } = body;

    // Create auth user server-side — never trust a client-supplied user ID
    const { data: created, error: createError } = await this.supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        organization,
        role: 'campaign-manager',
      },
    });

    if (createError || !created.user) {
      console.error('[CM Register] createUser failed:', createError?.message);
      throw new BadRequestException(createError?.message ?? 'Failed to create account');
    }

    const authUserId = created.user.id;

    // Upload documents with strict type + size validation
    let secDocKey: string | null = null;
    let orgDocKey: string | null = null;

    if (files.secRegistration?.[0]) {
      const docFile = files.secRegistration[0];
      if (docFile.size > AuthService.MAX_DOC_BYTES) {
        await this.supabase.auth.admin.deleteUser(authUserId);
        throw new BadRequestException('SEC Registration document must be under 5 MB');
      }
      const ext = docFile.originalname.split('.').pop()?.toLowerCase() ?? '';
      const allowedContentType = AuthService.ALLOWED_DOC_TYPES[ext];
      if (!allowedContentType) {
        await this.supabase.auth.admin.deleteUser(authUserId);
        throw new BadRequestException('SEC Registration document must be a PDF, JPG, or PNG');
      }

      const safePath = `${authUserId}/${Date.now()}-sec-registration.${ext}`;
      const { data: uploaded, error: uploadError } = await this.supabase.storage
        .from('camp-man-files')
        .upload(safePath, docFile.buffer, { contentType: allowedContentType, upsert: false });
      if (uploadError) {
        console.error('[CM Register] SEC registration upload failed:', uploadError.message);
      } else if (uploaded) {
        secDocKey = uploaded.path;
      }
    }

    if (files.orgCertificate?.[0]) {
      const docFile = files.orgCertificate[0];
      if (docFile.size > AuthService.MAX_DOC_BYTES) {
        await this.supabase.auth.admin.deleteUser(authUserId);
        throw new BadRequestException('Organizational Certificate must be under 5 MB');
      }
      const ext = docFile.originalname.split('.').pop()?.toLowerCase() ?? '';
      const allowedContentType = AuthService.ALLOWED_DOC_TYPES[ext];
      if (!allowedContentType) {
        await this.supabase.auth.admin.deleteUser(authUserId);
        throw new BadRequestException('Organizational Certificate must be a PDF, JPG, or PNG');
      }

      const safePath = `${authUserId}/${Date.now()}-org-certificate.${ext}`;
      const { data: uploaded, error: uploadError } = await this.supabase.storage
        .from('camp-man-files')
        .upload(safePath, docFile.buffer, { contentType: allowedContentType, upsert: false });
      if (uploadError) {
        console.error('[CM Register] Org certificate upload failed:', uploadError.message);
      } else if (uploaded) {
        orgDocKey = uploaded.path;
      }
    }

    const { error: insertError } = await this.supabase
      .from('campaign_manager_profiles')
      .insert({
        auth_user_id: authUserId,
        email,
        first_name: firstName,
        last_name: lastName,
        organization_name: organization,
        phone: contactNumber ?? null,
        sec_registration: secDocKey,
        organizational_certificate: orgDocKey,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      await this.supabase.auth.admin.deleteUser(authUserId);
      console.error('[CM Register] Profile insert failed:', insertError.message);
      throw new InternalServerErrorException('Failed to create campaign manager profile');
    }

    console.log('[CM Register] Registered:', authUserId, email);

    // Generate and send confirmation email (admin.createUser does not trigger Supabase's built-in email)
    try {
      const appUrl = this.configService.get<string>('NEXT_PUBLIC_APP_URL') || 'http://localhost:3001';
      const redirectTo = `${appUrl}/campaign-manager/auth/callback`;

      const { data: linkData, error: linkError } = await this.supabase.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: { redirectTo },
      });

      if (linkError || !linkData?.properties?.action_link) {
        console.warn('[CM Register] Could not generate confirmation link:', linkError?.message);
      } else {
        await sendConfirmationEmail(email, {
          name: `${firstName} ${lastName}`.trim(),
          confirmationUrl: linkData.properties.action_link,
        });
      }
    } catch (emailErr) {
      console.warn('[CM Register] Confirmation email failed (non-fatal):', emailErr);
    }

    this.events.emit(
      'hopecard.campaign_manager.registered',
      { authUserId, email },
      { partitionKey: authUserId, sourceServiceId: 'hopecard-campaign-manager-service' },
    );

    return { success: true, message: 'Registration submitted. Awaiting admin approval.' };
  }

  async login(email: string, password: string): Promise<{ success: boolean; token: string }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      if (error?.message?.toLowerCase().includes('email not confirmed')) {
        throw new UnauthorizedException('Please confirm your email address first. Check your inbox for the confirmation link we sent when you registered.');
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    const { data: profile, error: profileError } = await this.supabase
      .from('campaign_manager_profiles')
      .select('id, status, status_reason, status_expires_at')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();

    if (profileError) throw new InternalServerErrorException(profileError.message);
    if (!profile) throw new UnauthorizedException('No campaign manager account found for this email');

    const { status, status_reason: statusReason, status_expires_at: statusExpiresAt } =
      profile as { status: string; status_reason: string | null; status_expires_at: string | null };

    if (status === 'banned') {
      throw new ForbiddenException({
        reason: 'banned',
        status_reason: statusReason,
        status_expires_at: statusExpiresAt,
      });
    }

    if (status === 'suspended') {
      throw new ForbiddenException({
        reason: 'suspended',
        status_reason: statusReason,
        status_expires_at: statusExpiresAt,
      });
    }

    if (status !== 'approved' && status !== 'active') {
      throw new ForbiddenException({ reason: 'pending_approval', status });
    }

    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) throw new InternalServerErrorException('JWT_SECRET not configured');

    const token = await new SignJWT({
      sub: data.user.id,
      email: data.user.email,
      persona: 'cm',
      system: 'hopecard',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(secret));

    this.events.emit(
      'hopecard.campaign_manager.login',
      { authUserId: data.user.id, email: data.user.email ?? '' },
      { partitionKey: data.user.id, sourceServiceId: 'hopecard-campaign-manager-service' },
    );

    return { success: true, token };
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
