import { BadRequestException, Injectable, InternalServerErrorException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import { ProcedureEventService } from '@app/api-center';

@Injectable()
export class AuthService implements OnModuleInit {
  private supabase!: SupabaseClient;

  constructor(
    private configService: ConfigService,
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
    body: { authUserId: string; email: string; firstName: string; lastName: string; organization: string; contactNumber?: string },
    files: { secRegistration?: Express.Multer.File[]; orgCertificate?: Express.Multer.File[] },
  ): Promise<{ success: boolean; message: string }> {
    const { authUserId, email, firstName, lastName, organization, contactNumber } = body;

    if (!authUserId || !email || !firstName || !lastName || !organization) {
      throw new BadRequestException('authUserId, email, firstName, lastName, and organization are required');
    }

    // Verify the caller's identity by looking up the auth user by ID (not by client-supplied email)
    const { data: { user: authUser }, error: userError } = await this.supabase.auth.admin.getUserById(authUserId);
    if (userError || !authUser) throw new BadRequestException('Invalid authUserId');
    if (authUser.email !== email) throw new BadRequestException('Email does not match the authenticated user');

    // Idempotent — if profile already exists, return success
    const { data: existing } = await this.supabase
      .from('campaign_manager_profiles')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (existing) {
      return { success: true, message: 'Profile already registered. Awaiting admin approval.' };
    }

    // Upload documents to storage if provided, with strict type + size validation
    let documentKey: string | null = null;
    const docFile = files.secRegistration?.[0] ?? files.orgCertificate?.[0];
    if (docFile) {
      if (docFile.size > AuthService.MAX_DOC_BYTES) {
        throw new BadRequestException('Document file must be under 5 MB');
      }
      const ext = docFile.originalname.split('.').pop()?.toLowerCase() ?? '';
      const allowedContentType = AuthService.ALLOWED_DOC_TYPES[ext];
      if (!allowedContentType) {
        throw new BadRequestException('Document must be a PDF, JPG, or PNG');
      }

      const safePath = `${authUser.id}/${Date.now()}-org-doc.${ext}`;
      const { data: uploaded, error: uploadError } = await this.supabase.storage
        .from('campaign-manager-docs')
        .upload(safePath, docFile.buffer, { contentType: allowedContentType, upsert: false });
      if (!uploadError && uploaded) {
        documentKey = uploaded.path;
      }
    }

    const { error: insertError } = await this.supabase
      .from('campaign_manager_profiles')
      .insert({
        auth_user_id: authUser.id,
        email,
        first_name: firstName,
        last_name: lastName,
        organization_name: organization,
        phone: contactNumber ?? null,
        organization_document_key: documentKey,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) throw new InternalServerErrorException(`Failed to create campaign manager profile: ${insertError.message}`);

    this.events.emit(
      'hopecard.campaign_manager.registered',
      { authUserId: authUser.id, email },
      { partitionKey: authUser.id, sourceServiceId: 'hopecard-campaign-manager-service' },
    );

    return { success: true, message: 'Registration submitted. Awaiting admin approval.' };
  }

  async login(email: string, password: string): Promise<{ success: boolean; token: string }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { data: profile, error: profileError } = await this.supabase
      .from('campaign_manager_profiles')
      .select('id')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();

    if (profileError) throw new InternalServerErrorException(profileError.message);
    if (!profile) throw new UnauthorizedException('No campaign manager account found for this email');

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
