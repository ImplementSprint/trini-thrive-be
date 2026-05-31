import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import * as nodemailer from 'nodemailer';
import { ProcedureEventService } from '@app/api-center';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(private readonly events: ProcedureEventService) {}
  private get admin() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  private get mailer() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async signup(file: Express.Multer.File, dto: SignupDto): Promise<{ success: boolean; message: string }> {
    const admin = this.admin;
    const MAX_BYTES = 5 * 1024 * 1024;
    const SAFE_CONTENT_TYPES: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      pdf: 'application/pdf',
    };

    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_BYTES) throw new BadRequestException('File must be under 5 MB');
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    const contentType = SAFE_CONTENT_TYPES[ext];
    if (!contentType) throw new BadRequestException('File must be a JPG, PNG, or PDF');

    const { data: created, error } = await admin.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: false,
      user_metadata: { name: `${dto.firstName} ${dto.lastName}`.trim() },
    });

    if (error || !created.user) {
      throw new BadRequestException(error?.message ?? 'Failed to create user account');
    }

    const authUserId = created.user.id;

    const { data: profile, error: profileError } = await admin.from('beneficiary_profiles').insert({
      auth_user_id: authUserId,
      email: dto.email,
      first_name: dto.firstName,
      last_name: dto.lastName,
      status: 'pending',
      account_name: dto.accountName ?? null,
      account_number: dto.accountNumber ?? null,
      bank_name: dto.bankName ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select('id').single();

    if (profileError || !profile) {
      await admin.auth.admin.deleteUser(authUserId);
      throw new InternalServerErrorException('Failed to create profile');
    }

    const filename = `${profile.id}/${Date.now()}-id.${ext}`;

    const { data: uploadData, error: uploadError } = await admin.storage
      .from('beneficiary-ids')
      .upload(filename, file.buffer, { contentType, upsert: false });

    if (!uploadError && uploadData) {
      const uploadedPath = uploadData.path;
      const { data: { publicUrl } } = admin.storage.from('beneficiary-ids').getPublicUrl(filename);
      
      await admin.from('beneficiary_profiles').update({ id_verification_key: uploadedPath }).eq('id', profile.id);

      await admin.from('beneficiary_identity_documents').insert({
        beneficiary_profile_id: profile.id,
        document_key: uploadedPath,
        document_url: publicUrl,
        label: 'Signup Document',
        status: 'pending',
      });
    }

    if (dto.bankName && dto.accountName && dto.accountNumber) {
      await admin.from('beneficiary_bank_accounts').insert({
        beneficiary_profile_id: profile.id,
        bank_name: dto.bankName,
        account_holder_name: dto.accountName,
        account_number: dto.accountNumber,
        is_primary: true,
        is_active: true,
      });
    }

    // Generate signup confirmation link
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'signup',
      email: dto.email,
      options: {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/beneficiary/login`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      throw new InternalServerErrorException(linkError?.message ?? 'Failed to generate confirmation link');
    }

    const actionLink = linkData.properties.action_link;

    // Send confirmation email
    try {
      await this.mailer.sendMail({
        from: process.env.SMTP_FROM,
        to: dto.email,
        subject: 'Confirm your HOPECARD Beneficiary Account',
        html: `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #fff8f7; border-radius: 16px;">
            <h2 style="color: #97453e; margin: 0 0 8px;">Confirm your Account</h2>
            <p style="color: #554240; margin: 0 0 24px;">Thank you for registering with HOPECARD. Please click the button below to confirm your email address. Once confirmed, our administrators will review your application.</p>
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${actionLink}" style="display: inline-block; padding: 12px 24px; background: #97453e; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Confirm Email Address</a>
            </div>
            <p style="color: #554240; font-size: 0.875rem; margin: 0;">Or copy and paste this link in your browser:</p>
            <p style="color: #97453e; font-size: 0.875rem; word-break: break-all; margin: 8px 0 0;">${actionLink}</p>
          </div>
        `,
      });
    } catch (mailErr) {
      console.error('Failed to send confirmation email:', mailErr);
    }

    this.events.emit(
      'hopecard.beneficiary.registered',
      { authUserId, email: dto.email },
      { partitionKey: authUserId, sourceServiceId: 'hopecard-beneficiary-service' },
    );

    return { success: true, message: 'Account created successfully. Check your email to confirm your account.' };
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const admin = this.admin;

    // Verify the email exists in beneficiary_profiles
    const { data: profile, error: profileError } = await admin
      .from('beneficiary_profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException('Database error');
    }

    if (!profile) {
      throw new NotFoundException('No account found with that email address');
    }

    // Clear any existing unused OTPs for this email
    await admin
      .from('otp_sessions')
      .delete()
      .eq('email', email)
      .eq('used', false);

    // Generate and store new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const expiresAtMs = now + 10 * 60 * 1000;

    const { error: insertError } = await admin.from('otp_sessions').insert({
      email,
      otp,
      expires_at_ms: expiresAtMs,
      created_at_ms: now,
      used: false,
    });

    if (insertError) {
      throw new InternalServerErrorException('Failed to create OTP session');
    }

    // Send OTP email
    try {
      await this.mailer.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Your HOPECARD Password Reset Code',
        html: `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #fff8f7; border-radius: 16px;">
            <h2 style="color: #97453e; margin: 0 0 8px;">Password Reset</h2>
            <p style="color: #554240; margin: 0 0 24px;">Use the code below to reset your HOPECARD password. It expires in 10 minutes.</p>
            <div style="background: #fff; border: 1px solid #dac1be4d; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 2.5rem; font-weight: 800; letter-spacing: 0.3em; color: #241918;">${otp}</span>
            </div>
            <p style="color: #554240; font-size: 0.875rem; margin: 0;">If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch {
      throw new InternalServerErrorException('Failed to send OTP email');
    }

    return { success: true, message: 'A verification code has been sent to your email address.' };
  }

  async verifyResetOtp(email: string, otp: string): Promise<{ reset_token: string }> {
    const admin = this.admin;
    const now = Date.now();

    const { data: session, error } = await admin
      .from('otp_sessions')
      .select('id, expires_at_ms')
      .eq('email', email)
      .eq('otp', otp)
      .eq('used', false)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Database error');
    }

    if (!session) {
      throw new BadRequestException('Invalid or already-used verification code');
    }

    if (now > session.expires_at_ms) {
      throw new BadRequestException('Verification code has expired');
    }

    // Mark OTP as used
    await admin
      .from('otp_sessions')
      .update({ used: true })
      .eq('id', session.id);

    const reset_token = Buffer.from(
      JSON.stringify({ email, verified: true, timestamp: Date.now() }),
    ).toString('base64');

    return { reset_token };
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<{ success: boolean }> {
    let tokenData: { email: string; verified: boolean; timestamp: number };
    try {
      tokenData = JSON.parse(Buffer.from(resetToken, 'base64').toString('utf-8'));
      if (!tokenData.email || !tokenData.verified) throw new Error('invalid');
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const fifteenMinutes = 15 * 60 * 1000;
    if (Date.now() - tokenData.timestamp > fifteenMinutes) {
      throw new UnauthorizedException('Reset token has expired');
    }

    const email = tokenData.email;
    const admin = this.admin;

    // Look up the user's auth ID via beneficiary_profiles
    const { data: profile, error: profileError } = await admin
      .from('beneficiary_profiles')
      .select('auth_user_id')
      .eq('email', email)
      .maybeSingle();

    if (profileError || !profile) {
      throw new NotFoundException('User not found');
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      profile.auth_user_id,
      { password: newPassword },
    );

    if (updateError) {
      throw new InternalServerErrorException('Failed to update password');
    }

    return { success: true };
  }

  async login(email: string, password: string): Promise<{ success: boolean; token: string }> {
    const admin = this.admin;

    const { data, error } = await admin.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { data: profile, error: profileError } = await admin
      .from('beneficiary_profiles')
      .select('id, status, rejection_reason, status_reason, status_expires_at')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException('Database error');
    }
    if (!profile) {
      throw new UnauthorizedException('No beneficiary account found for this email');
    }

    if (profile.status === 'pending' || profile.status === 'pending_review') {
      throw new UnauthorizedException('Your account is still pending admin approval');
    }
    if (profile.status === 'rejected') {
      const reason = profile.rejection_reason ? `: ${profile.rejection_reason}` : '';
      throw new UnauthorizedException(`Your account application was rejected${reason}`);
    }
    if (profile.status === 'banned' || profile.status === 'suspended') {
      let durationStr = 'permanently';
      if (profile.status_expires_at) {
        const expDate = new Date(profile.status_expires_at);
        const diffDays = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        durationStr = diffDays > 0 ? `for ${diffDays} day(s)` : 'temporarily';
      }
      
      const reason = profile.status_reason ? `. Reason: ${profile.status_reason}` : '';
      throw new UnauthorizedException(`Your account has been ${profile.status} ${durationStr}${reason}`);
    }

    const secret = process.env['JWT_SECRET'];
    if (!secret) throw new InternalServerErrorException('JWT_SECRET not configured');

    const token = await new SignJWT({
      sub: data.user.id,
      email: data.user.email,
      persona: 'beneficiary',
      system: 'hopecard',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(secret));

    this.events.emit(
      'hopecard.beneficiary.login',
      { authUserId: data.user.id, email: data.user.email ?? email },
      { partitionKey: data.user.id, sourceServiceId: 'hopecard-beneficiary-service' },
    );

    return { success: true, token };
  }
}
