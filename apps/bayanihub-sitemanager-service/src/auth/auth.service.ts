import {
  Injectable,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '@app/supabase';
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private otpStore = new Map<string, { otp: string; expiresAt: number }>();
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST') || 'smtp.gmail.com',
      port: Number(this.config.get('SMTP_PORT')) || 587,
      secure: this.config.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.config.get('SMTP_USER') || '',
        pass: this.config.get('SMTP_PASS') || '',
      },
    });
  }

  private get db() {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  async login(dto: { email: string; password: string }) {
    const anonClient = createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_ANON_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data, error } = await anonClient.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error) {
      this.logger.warn(`Site manager login failed for ${dto.email}: ${error.message}`);
      throw new UnauthorizedException('Invalid email or password.');
    }

    const { data: profile } = await this.db
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .single();

    const secret = process.env['JWT_SECRET'] ?? '';
    const token = await new SignJWT({
      sub: data.user.id,
      email: data.user.email,
      persona: 'site-manager',
      system: 'bayanihub',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(secret));

    return {
      access_token: token,
      user: { id: data.user.id, email: data.user.email, profile: profile ?? null },
    };
  }

  async sendOtp(email: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.otpStore.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    try {
      const smtpUser = this.config.get('SMTP_USER') || 'noreply@bayanihub.ph';
      await this.transporter.sendMail({
        from: `"BayaniHub Security" <${smtpUser}>`,
        to: email,
        subject: 'Your BayaniHub Verification Code',
        html: `<div style="font-family:sans-serif;padding:20px;"><h2>BayaniHub Security Verification</h2><p>Your 6-digit verification code is:</p><h1 style="letter-spacing:5px;color:#5E70DC;">${otp}</h1><p>This code will expire in 10 minutes.</p></div>`,
      });
      this.logger.log(`Sent OTP to ${email}`);
      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      this.logger.error(`Failed to send OTP to ${email}`, error);
      throw new HttpException('Failed to send email', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async verifyOtp(email: string, otp: string) {
    const record = this.otpStore.get(email);
    if (!record) throw new HttpException('No OTP found or expired', HttpStatus.BAD_REQUEST);
    if (Date.now() > record.expiresAt) {
      this.otpStore.delete(email);
      throw new HttpException('OTP has expired', HttpStatus.BAD_REQUEST);
    }
    if (record.otp !== otp) throw new HttpException('Invalid OTP', HttpStatus.BAD_REQUEST);
    return { success: true };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    await this.verifyOtp(email, otp);

    const { data: usersData, error: userError } = await this.db.auth.admin.listUsers();
    if (userError || !usersData) throw new HttpException('Failed to fetch users', HttpStatus.INTERNAL_SERVER_ERROR);

    const user = usersData.users.find((u: any) => u.email === email);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const { error: updateError } = await this.db.auth.admin.updateUserById(user.id, { password: newPassword });
    if (updateError) throw new HttpException(updateError.message, HttpStatus.BAD_REQUEST);

    this.otpStore.delete(email);
    return { success: true, message: 'Password updated successfully' };
  }
}
