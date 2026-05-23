import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '@app/supabase';
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';
import type { LoginAdminDto } from './dto/login-admin.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { VerifyOtpDto } from './dto/verify-otp.dto';

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

const OTP_STORE = new Map<string, OtpEntry>();
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly smtpConfigured: boolean;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS');

    this.smtpConfigured = !!(smtpHost && smtpUser && smtpPass);

    this.transporter = nodemailer.createTransport({
      host: smtpHost ?? 'smtp.gmail.com',
      port: Number(this.config.get<string>('SMTP_PORT') ?? '587'),
      secure: false,
      auth: { user: smtpUser ?? '', pass: smtpPass ?? '' },
    });
  }

  async login(dto: LoginAdminDto) {
    const url = this.config.getOrThrow<string>('SUPABASE_URL');
    const anonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY');

    const anonClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await anonClient.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error || !data.user) {
      this.logger.warn(`Admin login failed for ${dto.email}: ${error?.message ?? 'no user'}`);
      throw new UnauthorizedException('Invalid email or password.');
    }

    const client = this.supabase.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');

    const { data: profile } = await client
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      throw new ForbiddenException('Access denied. Admin accounts only.');
    }

    const jwtSecret = this.config.getOrThrow<string>('JWT_SECRET');
    const accessToken = await new SignJWT({
      sub: data.user.id,
      email: data.user.email,
      persona: 'admin',
      system: 'bayanihub',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(jwtSecret));

    this.logger.log(`Admin login success: ${dto.email}`);

    return {
      access_token: accessToken,
      user: { id: data.user.id, email: data.user.email, profile },
    };
  }

  async getProfile(authUserId: string) {
    const client = this.supabase.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');

    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    if (error || !data) throw new BadRequestException('Profile not found.');
    return data;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const client = this.supabase.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');

    const { data, error } = await client.auth.admin.listUsers();
    if (error) throw new InternalServerErrorException('Could not process request.');

    const user = data.users.find((u) => u.email === dto.email);
    if (user) {
      const { data: profile } = await client
        .from('user_profiles')
        .select('role')
        .eq('auth_user_id', user.id)
        .single();

      if (profile?.role === 'admin') {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + OTP_TTL_MS;
        OTP_STORE.set(dto.email.toLowerCase(), { code, expiresAt, attempts: 0 });
        this.logger.log(`OTP for ${dto.email}: ${code}`);

        if (this.smtpConfigured) {
          await this.sendOtpEmail(dto.email, code);
        }
      }
    }

    return { message: 'If that admin email is registered, a code has been sent.' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const key = dto.email.toLowerCase();
    const entry = OTP_STORE.get(key);

    if (!entry) throw new BadRequestException('No OTP was requested for this email.');
    if (Date.now() > entry.expiresAt) {
      OTP_STORE.delete(key);
      throw new BadRequestException('OTP has expired. Please request a new code.');
    }
    if (entry.attempts >= MAX_OTP_ATTEMPTS) {
      OTP_STORE.delete(key);
      throw new BadRequestException('Too many failed attempts. Please request a new code.');
    }
    if (entry.code !== dto.code) {
      entry.attempts += 1;
      throw new BadRequestException('Invalid OTP code. Please try again.');
    }

    return { verified: true, message: 'OTP verified successfully.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const key = dto.email.toLowerCase();
    const entry = OTP_STORE.get(key);

    if (!entry) throw new BadRequestException('No OTP was requested for this email.');
    if (Date.now() > entry.expiresAt) {
      OTP_STORE.delete(key);
      throw new BadRequestException('OTP has expired. Please request a new code.');
    }
    if (entry.code !== dto.otp) throw new BadRequestException('Invalid OTP code.');

    const client = this.supabase.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');

    const { data, error } = await client.auth.admin.listUsers();
    if (error) throw new InternalServerErrorException('Could not process request.');

    const user = data.users.find((u) => u.email === dto.email);
    if (!user) throw new BadRequestException('No account found with that email.');

    const { data: profile } = await client
      .from('user_profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      throw new ForbiddenException('Access denied. Admin accounts only.');
    }

    const { error: updateError } = await client.auth.admin.updateUserById(user.id, {
      password: dto.newPassword,
    });

    if (updateError) throw new InternalServerErrorException('Could not reset password.');

    OTP_STORE.delete(key);
    this.logger.log(`Password reset successful for admin: ${dto.email}`);
    return { message: 'Password has been reset successfully.' };
  }

  private async sendOtpEmail(email: string, code: string): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM') ?? `"BayaniHub Admin" <${this.config.get<string>('SMTP_USER')}>`;
    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: `Your BayaniHub Admin OTP: ${code}`,
        html: `<p>Your OTP is: <strong>${code}</strong>. Expires in 10 minutes.</p>`,
      });
    } catch (err: unknown) {
      this.logger.error(`Failed to send OTP email: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
