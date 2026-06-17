import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { SignJWT } from 'jose';
import { SupabaseService } from '@app/supabase';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, RecoveryMethod } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const DAMAYAN_SYSTEM = 'damayan';
const SM_PERSONA = 'site_manager';
const ALLOWED_ROLES = ['line_manager', 'site_manager'];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  private getClient() {
    const client = this.supabaseService.getClient();
    if (!client) throw new Error('Supabase client not initialized');
    return client as any;
  }

  private getJwtSecret() {
    const secret = this.configService.get<string>('JWT_SECRET') ?? process.env['JWT_SECRET'] ?? '';
    return new TextEncoder().encode(secret);
  }

  private async signToken(payload: Record<string, unknown>, expiresIn: string) {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(expiresIn)
      .sign(this.getJwtSecret());
  }

  private withTimeout<T = any>(promise: PromiseLike<T>, message: string, ms = 8000): Promise<T> {
    return Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => setTimeout(() => reject(new GatewayTimeoutException(message)), ms)),
    ]);
  }

  async login(dto: LoginDto) {
    const supabase = this.getClient();
    const { data, error } = await this.withTimeout(
      supabase.auth.signInWithPassword({ email: dto.email, password: dto.password }),
      'Authentication timed out during login.',
    );

    if (error || !data?.user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userId = data.user.id;
    const { data: profile, error: profileError } = await this.withTimeout(
      supabase.from('user_profiles').select('*').eq('auth_user_id', userId).maybeSingle(),
      'Profile lookup timed out.',
    );

    if (profileError || !profile) {
      throw new UnauthorizedException('Profile not found');
    }

    if (!ALLOWED_ROLES.includes(profile.role)) {
      throw new UnauthorizedException('Access restricted to site manager accounts');
    }

    if (profile.status === 'pending') {
      return { status: 'pending_approval', message: 'Your account is pending approval.' };
    }

    if (profile.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    const expiresIn = dto.rememberMe ? '30d' : '8h';
    const token = await this.signToken(
      {
        sub: userId,
        email: data.user.email,
        persona: SM_PERSONA,
        system: DAMAYAN_SYSTEM,
        role: profile.role,
        profileId: profile.id,
      },
      expiresIn,
    );

    return { status: 'success', token, profile };
  }

  async getProfile(userId: string) {
    const { data, error } = await this.getClient()
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updates: Record<string, unknown> = {};
    if (dto.firstName !== undefined) updates['first_name'] = dto.firstName;
    if (dto.lastName !== undefined) updates['last_name'] = dto.lastName;
    if (dto.phone !== undefined) updates['phone'] = dto.phone;

    const { data, error } = await this.getClient()
      .from('user_profiles')
      .update(updates)
      .eq('auth_user_id', userId)
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const contact = dto.contact.trim();
    const method = dto.method ?? RecoveryMethod.EMAIL;
    const code = String(randomInt(100000, 999999));
    const hash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await this.getClient()
      .from('password_reset_tokens')
      .upsert({ contact, token_hash: hash, expires_at: expiresAt, used: false }, { onConflict: 'contact' });

    this.logger.log(`[forgotPassword] Code ${code} for ${contact} via ${method}`);
    return { message: 'If the account exists, a recovery code has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const code = dto.code ?? dto.verificationCode ?? '';
    const hash = createHash('sha256').update(code).digest('hex');
    const contact = dto.contact.trim();

    const { data: token } = await this.getClient()
      .from('password_reset_tokens')
      .select('*')
      .eq('contact', contact)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!token) throw new BadRequestException('Invalid or expired reset code');

    const storedHash = Buffer.from(token.token_hash as string);
    const providedHash = Buffer.from(hash);
    if (storedHash.length !== providedHash.length || !timingSafeEqual(storedHash, providedHash)) {
      throw new BadRequestException('Invalid reset code');
    }

    const { data: userProfile } = await this.getClient()
      .from('user_profiles')
      .select('auth_user_id')
      .eq('phone', contact)
      .maybeSingle();

    if (!userProfile?.auth_user_id) throw new BadRequestException('Account not found');

    const { error } = await this.getClient().auth.admin.updateUserById(userProfile.auth_user_id, {
      password: dto.newPassword,
    });
    if (error) throw new BadRequestException(error.message);

    await this.getClient()
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('contact', contact);

    return { message: 'Password reset successfully' };
  }
}
