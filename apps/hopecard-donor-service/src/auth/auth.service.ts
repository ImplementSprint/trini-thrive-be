import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  Inject,
  Optional,
} from '@nestjs/common';
import { TribeClient } from '@implementsprint/sdk';
import { createClient } from '@supabase/supabase-js';
import { decodeJwt, SignJWT } from 'jose';
import * as nodemailer from 'nodemailer';
import { supabase } from '@app/common/supabase-client';
import { supabaseRequest } from '@app/common/supabase-helpers';
import { ProcedureEventService } from '@app/api-center';
import type { SignupDto } from './dto/signup.dto';

const getJwtSecret = () => new TextEncoder().encode(process.env['JWT_SECRET'] ?? '');

@Injectable()
export class AuthService {
  constructor(
    @Optional() @Inject(TribeClient) private readonly client: TribeClient | null,
    private readonly events: ProcedureEventService,
  ) {}

  private get admin() {
    return createClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL']!,
      process.env['SUPABASE_SERVICE_ROLE_KEY']!,
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

  // ── Email / password auth ────────────────────────────────────────────────

  async signup(dto: SignupDto): Promise<{ success: boolean; message: string }> {
    const admin = this.admin;

    const { data: created, error } = await admin.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      user_metadata: { name: `${dto.first_name} ${dto.last_name}`.trim() },
    });

    if (error || !created.user) {
      throw new BadRequestException(error?.message ?? 'Failed to create user account');
    }

    const { error: profileError } = await admin.from('digital_donor_profiles').insert({
      auth_user_id: created.user.id,
      email: dto.email,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone ?? null,
      address: dto.address ?? null,
      id_verification_key: dto.id_verification_key ?? null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw new InternalServerErrorException('Failed to create donor profile');
    }

    this.events.emit(
      'hopecard.donor.registered',
      { authUserId: created.user.id, email: dto.email },
      { partitionKey: created.user.id, sourceServiceId: 'hopecard-donor-service' },
    );

    return { success: true, message: 'Account created successfully. Awaiting admin approval.' };
  }

  async login(email: string, password: string): Promise<{ success: boolean; token: string; session: unknown; status: string }> {
    const admin = this.admin;

    const { data, error } = await admin.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { data: profile, error: profileError } = await admin
      .from('digital_donor_profiles')
      .select('id, status')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();

    if (profileError) throw new InternalServerErrorException('Database error');
    if (!profile) throw new UnauthorizedException('No donor account found for this email');

    const status = (profile as any).status as string;
    if (status !== 'approved') {
      throw new ForbiddenException({ reason: 'pending_approval', status });
    }

    const secret = process.env['JWT_SECRET'];
    if (!secret) throw new InternalServerErrorException('JWT_SECRET not configured');

    const token = await new SignJWT({
      sub: data.user.id,
      email: data.user.email,
      persona: 'donor',
      system: 'hopecard',
      scopes: ['payment:charge', 'payment:refund'],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(secret));

    this.events.emit(
      'hopecard.donor.login',
      { authUserId: data.user.id, email: data.user.email ?? email },
      { partitionKey: data.user.id, sourceServiceId: 'hopecard-donor-service' },
    );

    return { success: true, token, session: data.session, status };
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const admin = this.admin;

    const { data: profile } = await admin
      .from('digital_donor_profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!profile) {
      throw new NotFoundException('No account found with that email address');
    }

    await admin.from('otp_sessions').delete().eq('email', email).eq('used', false);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();

    const { error: insertError } = await admin.from('otp_sessions').insert({
      email,
      otp,
      expires_at_ms: now + 10 * 60 * 1000,
      created_at_ms: now,
      used: false,
    });

    if (insertError) {
      throw new InternalServerErrorException('Failed to create OTP session');
    }

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

  async verifyOtp(email: string, otp: string): Promise<{ reset_token: string }> {
    const admin = this.admin;
    const now = Date.now();

    const { data: session, error } = await admin
      .from('otp_sessions')
      .select('id, expires_at_ms')
      .eq('email', email)
      .eq('otp', otp)
      .eq('used', false)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Database error');
    if (!session) throw new BadRequestException('Invalid or already-used verification code');
    if (now > (session as any).expires_at_ms) throw new BadRequestException('Verification code has expired');

    await admin.from('otp_sessions').update({ used: true }).eq('id', (session as any).id);

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

    if (Date.now() - tokenData.timestamp > 15 * 60 * 1000) {
      throw new UnauthorizedException('Reset token has expired');
    }

    const admin = this.admin;

    const { data: profile, error: profileError } = await admin
      .from('digital_donor_profiles')
      .select('auth_user_id')
      .eq('email', tokenData.email)
      .maybeSingle();

    if (profileError || !profile) throw new NotFoundException('User not found');

    const { error: updateError } = await admin.auth.admin.updateUserById(
      (profile as any).auth_user_id,
      { password: newPassword },
    );

    if (updateError) throw new InternalServerErrorException('Failed to update password');

    return { success: true };
  }

  // ── Google OAuth ─────────────────────────────────────────────────────────

  async googleGetAuthUrl() {
    if (!this.client) throw new HttpException('Auth service unavailable', 503);
    const redirectUri = `${process.env['NEXT_PUBLIC_APP_URL']}/auth/google/callback`;
    const result = await this.client.gauthGetAuthorizationUrl({
      redirectUri,
      scopes: ['openid', 'email', 'profile'],
      accessType: 'offline',
    });
    return { url: (result as any).authorizationUrl ?? (result as any).url };
  }

  async googleCallback(code: string) {
    if (!this.client) throw new HttpException('Auth service unavailable', 503);
    if (!code) throw new HttpException('Missing authorization code', 400);

    const redirectUri = `${process.env['NEXT_PUBLIC_APP_URL']}/auth/google/callback`;
    const tokens = await this.client.gauthExchangeCode({ code, redirectUri });

    const idToken = (tokens as any).idToken ?? (tokens as any).id_token;
    if (!idToken) throw new HttpException('No ID token returned from Google', 400);

    let email: string, firstName: string, lastName: string, googleSub: string;
    try {
      const claims = decodeJwt(idToken as string);
      email = claims['email'] as string;
      googleSub = claims['sub'] as string;
      const fullName = ((claims['name'] as string) ?? '').trim();
      const parts = fullName.split(' ');
      firstName = parts[0] ?? '';
      lastName = parts.slice(1).join(' ');
    } catch {
      throw new HttpException('Failed to decode Google ID token', 400);
    }

    if (!email) throw new HttpException('No email in Google token', 400);

    const { data: listData } = await supabase.auth.admin.listUsers();
    let authUserId: string;
    const existing = listData?.users?.find((u) => u.email === email);

    if (existing) {
      authUserId = existing.id;
    } else {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: `${firstName} ${lastName}`.trim(), google_sub: googleSub },
      });
      if (error || !created.user) throw new HttpException('Failed to create user account', 500);
      authUserId = created.user.id;
    }

    const profiles = await supabaseRequest<{ id: string; first_name: string; status: string }[]>(
      `digital_donor_profiles?auth_user_id=eq.${authUserId}&select=id,first_name,status&limit=1`,
    );

    let isNew = false;
    if (profiles.length === 0) {
      await supabaseRequest('digital_donor_profiles', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          auth_user_id: authUserId,
          email,
          first_name: firstName,
          last_name: lastName,
          status: 'pending',
          created_at: new Date().toISOString(),
        }),
      });
      isNew = true;
    }

    this.events.emit(
      isNew ? 'hopecard.donor.google_registered' : 'hopecard.donor.google_login',
      { authUserId, email },
      { partitionKey: authUserId, sourceServiceId: 'hopecard-donor-service' },
    );

    const token = await new SignJWT({
      sub: authUserId,
      email,
      name: `${firstName} ${lastName}`.trim(),
      persona: 'donor',
      system: 'hopecard',
      scopes: ['payment:charge', 'payment:refund'],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(getJwtSecret());

    return { token, isNew, authUserId };
  }
}
