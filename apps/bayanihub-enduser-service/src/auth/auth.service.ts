import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '@app/supabase';
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';
import {
  CreateUserDto,
  LoginUserDto,
  ForgotPasswordDto,
  VerifyOtpDto,
  ResetPasswordDto,
} from './dto/auth.dto';

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
  private readonly BUCKET = 'identity-documents';
  private readonly transporter: nodemailer.Transporter;
  private readonly smtpConfigured: boolean;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly config: ConfigService,
  ) {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS');

    this.smtpConfigured = !!(
      smtpHost &&
      smtpUser &&
      smtpPass &&
      smtpPass !== 'YOUR_GMAIL_APP_PASSWORD_HERE' &&
      smtpPass !== 'your-google-app-password'
    );

    this.transporter = nodemailer.createTransport({
      host: smtpHost || 'smtp.gmail.com',
      port: Number(this.config.get<string>('SMTP_PORT') || '587'),
      secure: false,
      auth: { user: smtpUser || '', pass: smtpPass || '' },
    });

    if (this.smtpConfigured) {
      this.logger.log('SMTP configured — OTP emails will be sent.');
    } else {
      this.logger.warn('SMTP not configured. OTP codes will be logged to console only.');
    }
  }

  private get db() {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  async register(dto: CreateUserDto, file: Express.Multer.File) {
    const { data: authData, error: authError } = await this.db.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
    });

    if (authError) {
      this.logger.warn(`Auth createUser failed: ${authError.message}`);
      throw new BadRequestException(authError.message);
    }

    const userId = authData.user.id;
    this.logger.log(`Step A complete — auth user created: ${userId}`);

    let idUrl: string;
    const filePath = `${userId}/${Date.now()}-${file.originalname}`;

    try {
      const { error: uploadError } = await this.db.storage
        .from(this.BUCKET)
        .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = this.db.storage.from(this.BUCKET).getPublicUrl(filePath);
      idUrl = urlData.publicUrl;
      this.logger.log(`Step B complete — document uploaded: ${filePath}`);
    } catch (uploadErr: any) {
      this.logger.error(`Step B failed — rolling back auth user ${userId}`);
      await this.rollbackAuthUser(userId);
      throw new InternalServerErrorException(`Document upload failed: ${uploadErr.message}`);
    }

    try {
      const { error: profileError } = await this.db.from('user_profiles').insert({
        auth_user_id: userId,
        email: dto.email.toLowerCase().trim(),
        first_name: dto.first_name,
        last_name: dto.last_name,
        phone: this.normalizePhone(dto.phone),
        dob: dto.dob,
        address: dto.address ?? null,
        barangay: dto.barangay ?? null,
        municipality: dto.municipality ?? null,
        province: dto.province ?? null,
        id_url: idUrl,
        is_verified: false,
        role: 'end_user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (profileError) throw new Error(profileError.message);
      this.logger.log(`Step C complete — profile created for ${userId}`);
    } catch (profileErr: any) {
      this.logger.error(`Step C failed — rolling back storage + auth for ${userId}`);
      await this.rollbackStorageFile(filePath);
      await this.rollbackAuthUser(userId);
      throw new InternalServerErrorException(`Profile creation failed: ${profileErr.message}`);
    }

    return {
      message: 'Registration successful. Please verify your email.',
      userId,
      email: dto.email,
    };
  }

  async login(dto: LoginUserDto) {
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
      this.logger.warn(`Login failed for ${dto.email}: ${error.message}`);
      if (error.message.toLowerCase().includes('email not confirmed')) {
        throw new UnauthorizedException('Email not confirmed. Please confirm your account.');
      }
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
      persona: 'enduser',
      system: 'bayanihub',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(secret));

    return {
      access_token: token,
      user: {
        id: data.user.id,
        email: data.user.email,
        profile: profile ?? null,
      },
    };
  }

  async getProfile(authUserId: string) {
    const { data, error } = await this.db
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    if (error || !data) throw new BadRequestException('Profile not found.');
    return data;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const { data, error } = await this.db.auth.admin.listUsers();

    if (error) {
      this.logger.error(`listUsers failed: ${error.message}`);
      throw new InternalServerErrorException('Could not process request.');
    }

    const user = data.users.find(
      (u) => u.email?.toLowerCase() === dto.email.toLowerCase().trim(),
    );

    if (user) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + OTP_TTL_MS;
      OTP_STORE.set(dto.email.toLowerCase().trim(), { code, expiresAt, attempts: 0 });
      this.logger.log(`OTP for ${dto.email}: ${code} (expires ${new Date(expiresAt).toISOString()})`);
      if (this.smtpConfigured) await this.sendOtpEmail(dto.email.toLowerCase().trim(), code);
    }

    return { message: 'If that email is registered, a code has been sent.' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const key = dto.email.toLowerCase().trim();
    const entry = OTP_STORE.get(key);

    if (!entry) throw new BadRequestException('No OTP was requested for this email. Please request a new code.');
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
    const key = dto.email.toLowerCase().trim();
    const entry = OTP_STORE.get(key);

    if (!entry) throw new BadRequestException('No OTP was requested for this email.');
    if (Date.now() > entry.expiresAt) {
      OTP_STORE.delete(key);
      throw new BadRequestException('OTP has expired. Please request a new code.');
    }
    if (entry.code !== dto.otp) throw new BadRequestException('Invalid OTP code.');

    const { data, error } = await this.db.auth.admin.listUsers();
    if (error) throw new InternalServerErrorException('Could not process request.');

    const user = data.users.find(
      (u) => u.email?.toLowerCase() === dto.email.toLowerCase().trim(),
    );
    if (!user) throw new BadRequestException('No account found with that email.');

    const { error: updateError } = await this.db.auth.admin.updateUserById(user.id, {
      password: dto.newPassword,
    });
    if (updateError) throw new InternalServerErrorException('Failed to reset password.');

    OTP_STORE.delete(key);
    return { message: 'Password has been reset successfully.' };
  }

  private async sendOtpEmail(email: string, code: string): Promise<void> {
    const fromAddr =
      this.config.get<string>('SMTP_FROM') ||
      `"BayaniHub" <${this.config.get<string>('SMTP_USER')}>`;

    try {
      await this.transporter.sendMail({
        from: fromAddr,
        to: email,
        subject: `Your BayaniHub OTP: ${code}`,
        html: `<div style="font-family:sans-serif;padding:20px;"><h2>BayaniHub — Password Recovery</h2><p>Your one-time code is:</p><h1 style="letter-spacing:5px;color:#5C6ED5;">${code}</h1><p>This code expires in <strong>10 minutes</strong>.</p></div>`,
      });
      this.logger.log(`OTP email sent to ${email}`);
    } catch (err: any) {
      this.logger.error(`Failed to send OTP email to ${email}: ${err.message}`);
    }
  }

  private normalizePhone(raw: string): string {
    const digits = raw.replace(/[\s\-()]/g, '');
    if (digits.startsWith('+63')) return digits;
    if (digits.startsWith('0') && digits.length === 11) return `+63${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith('9')) return `+63${digits}`;
    return digits;
  }

  private async rollbackAuthUser(userId: string): Promise<void> {
    try {
      const { error } = await this.db.auth.admin.deleteUser(userId);
      if (error) this.logger.error(`Rollback auth user failed: ${error.message}`);
      else this.logger.warn(`Rolled back auth user: ${userId}`);
    } catch (err: any) {
      this.logger.error(`Rollback auth user exception: ${err.message}`);
    }
  }

  private async rollbackStorageFile(filePath: string): Promise<void> {
    try {
      const { error } = await this.db.storage.from(this.BUCKET).remove([filePath]);
      if (error) this.logger.error(`Rollback storage file failed: ${error.message}`);
      else this.logger.warn(`Rolled back storage file: ${filePath}`);
    } catch (err: any) {
      this.logger.error(`Rollback storage file exception: ${err.message}`);
    }
  }
}
