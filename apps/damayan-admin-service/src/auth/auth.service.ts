import {
  BadRequestException,
  ConflictException,
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
const ADMIN_PERSONA = 'admin';

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
      supabase.from('user_profiles').select('id, first_name, last_name, phone, role, status').eq('auth_user_id', userId).maybeSingle(),
      'Profile lookup timed out.',
    );

    if (profileError) throw new BadRequestException(profileError.message);

    const userRole = (profile?.role as string) ?? 'citizen';
    if (userRole !== 'admin') {
      throw new UnauthorizedException('This account does not have admin access.');
    }

    const expiresIn = dto.rememberMe ? '30d' : '7d';
    const token = await this.signToken({
      sub: userId,
      email: dto.email,
      persona: ADMIN_PERSONA,
      system: DAMAYAN_SYSTEM,
      name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
    }, expiresIn);

    return {
      message: 'Login successful',
      access_token: token,
      expiresIn,
      user: {
        id: profile?.id ?? userId,
        authUserId: userId,
        firstName: profile?.first_name ?? '',
        lastName: profile?.last_name ?? '',
        name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
        email: dto.email,
        phone: profile?.phone ?? '',
        role: userRole,
        persona: ADMIN_PERSONA,
        system: DAMAYAN_SYSTEM,
        accountStatus: (profile?.status as string) ?? 'active',
      },
    };
  }

  async getProfile(userId: string) {
    const supabase = this.getClient();
    const [{ data: profile, error: profileError }, { data: authUser, error: authError }] = await Promise.all([
      this.withTimeout(
        supabase.from('user_profiles').select('id, first_name, last_name, phone, role, status, auth_user_id, profile_photo_key, gender, address, barangay, municipality, province').eq('auth_user_id', userId).maybeSingle(),
        'Profile lookup timed out.',
      ),
      this.withTimeout(supabase.auth.admin.getUserById(userId), 'Auth lookup timed out.'),
    ]);

    if (profileError) throw new BadRequestException(profileError.message);
    if (authError) throw new BadRequestException(authError.message);

    return {
      user: {
        id: profile?.id ?? userId,
        authUserId: userId,
        firstName: profile?.first_name ?? '',
        lastName: profile?.last_name ?? '',
        name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
        email: authUser?.user?.email ?? '',
        phone: profile?.phone ?? '',
        role: profile?.role ?? 'admin',
        persona: ADMIN_PERSONA,
        system: DAMAYAN_SYSTEM,
        accountStatus: profile?.status ?? 'active',
        profilePhotoKey: profile?.profile_photo_key ?? null,
        gender: profile?.gender ?? null,
        address: profile?.address ?? null,
        barangay: profile?.barangay ?? null,
        municipality: profile?.municipality ?? null,
        province: profile?.province ?? null,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const supabase = this.getClient();
    const updates: Record<string, unknown> = {};
    if (dto.firstName) updates.first_name = dto.firstName;
    if (dto.lastName) updates.last_name = dto.lastName;
    if (dto.phone) updates.phone = dto.phone;
    if (dto.profilePhotoKey !== undefined) updates.profile_photo_key = dto.profilePhotoKey;
    if (dto.gender !== undefined) updates.gender = dto.gender;
    if (dto.address !== undefined) updates.address = dto.address;
    if (dto.barangay !== undefined) updates.barangay = dto.barangay;
    if (dto.municipality !== undefined) updates.municipality = dto.municipality;
    if (dto.province !== undefined) updates.province = dto.province;

    if (Object.keys(updates).length > 0) {
      const { error } = await this.withTimeout(
        supabase.from('user_profiles').update(updates).eq('auth_user_id', userId),
        'Profile update timed out.',
      );
      if (error) throw new BadRequestException(error.message);
    }

    if (dto.email) {
      const { error } = await this.withTimeout(
        supabase.auth.admin.updateUserById(userId, { email: dto.email.trim().toLowerCase() }),
        'Email update timed out.',
      );
      if (error) throw new BadRequestException(error.message);
    }

    return this.getProfile(userId);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const supabase = this.getClient();
    const method = dto.method ?? (dto.contact?.includes('@') ? RecoveryMethod.EMAIL : RecoveryMethod.SMS);
    const contact = method === RecoveryMethod.EMAIL ? (dto.email ?? dto.contact ?? '') : (dto.phone ?? dto.contact ?? '');

    if (!contact) throw new BadRequestException('A valid contact is required');

    const { userId, email } = await this.findUserForReset(contact, method);
    const code = randomInt(1000, 10000).toString();
    const tokenHash = createHash('sha256').update(code).digest('hex');

    await supabase.from('password_reset_requests').update({ status: 'expired' }).eq('email', email).eq('status', 'pending');
    const { error } = await supabase.from('password_reset_requests').insert({
      auth_user_id: userId,
      email,
      token_hash: tokenHash,
      status: 'pending',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      used_at: null,
    });
    if (error) throw new BadRequestException(`Could not store reset request: ${error.message}`);

    this.logger.log(`Password reset code issued for ${email}`);

    return {
      message: 'Verification code sent',
      maskedContact: this.maskContact(contact, method),
      ...(process.env['NODE_ENV'] !== 'production' ? { debugVerificationCode: code } : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const code = dto.code ?? dto.verificationCode;
    if (!code) throw new BadRequestException('Verification code is required');

    const supabase = this.getClient();
    const method = dto.contact.includes('@') ? RecoveryMethod.EMAIL : RecoveryMethod.SMS;
    const { email } = await this.findUserForReset(dto.contact, method);

    const { data: req, error: reqError } = await supabase
      .from('password_reset_requests')
      .select('id, auth_user_id, token_hash, status, expires_at, used_at')
      .eq('email', email)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (reqError) throw new BadRequestException(reqError.message);
    if (!req) throw new UnauthorizedException('Invalid verification code');
    if (req.used_at) throw new UnauthorizedException('Verification code already used');
    if (new Date(req.expires_at).getTime() < Date.now()) {
      await supabase.from('password_reset_requests').update({ status: 'expired' }).eq('id', req.id);
      throw new UnauthorizedException('Verification code expired');
    }

    const incoming = createHash('sha256').update(code).digest('hex');
    const leftBuf = Buffer.from(req.token_hash as string, 'utf8');
    const rightBuf = Buffer.from(incoming, 'utf8');
    if (leftBuf.length !== rightBuf.length || !timingSafeEqual(leftBuf, rightBuf)) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const { error: pwError } = await supabase.auth.admin.updateUserById(req.auth_user_id as string, { password: dto.newPassword });
    if (pwError) throw new BadRequestException(pwError.message);

    await supabase.from('password_reset_requests').update({ status: 'used', used_at: new Date().toISOString() }).eq('id', req.id);

    return { message: 'Password reset successful.' };
  }

  private async findUserForReset(contact: string, method: RecoveryMethod): Promise<{ userId: string; email: string }> {
    const supabase = this.getClient();
    if (method === RecoveryMethod.EMAIL) {
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) throw new BadRequestException(error.message);
      const user = data.users.find((u: any) => u.email?.toLowerCase() === contact.toLowerCase());
      if (!user) throw new BadRequestException('No account found for that email');
      return { userId: user.id as string, email: contact };
    }
    const { data: profiles, error } = await supabase.from('user_profiles').select('auth_user_id, phone').not('auth_user_id', 'is', null);
    if (error) throw new BadRequestException(error.message);
    const match = (profiles as Array<{ auth_user_id: string; phone: string }>).find(p => p.phone === contact);
    if (!match) throw new BadRequestException('No account found for that phone number');
    const { data: au } = await supabase.auth.admin.getUserById(match.auth_user_id);
    return { userId: match.auth_user_id, email: au?.user?.email ?? '' };
  }

  private maskContact(contact: string, method: RecoveryMethod): string {
    if (method === RecoveryMethod.EMAIL) {
      const [username, domain] = contact.split('@');
      return `${username.slice(0, 2)}***${username.slice(-1)}@${domain}`;
    }
    return `${contact.slice(0, 6)}***${contact.slice(-2)}`;
  }

  private async withTimeout<T>(promise: Promise<T>, message: string, ms = 15_000): Promise<T> {
    let handle: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          handle = setTimeout(() => reject(new GatewayTimeoutException(message)), ms);
        }),
      ]);
    } finally {
      if (handle) clearTimeout(handle);
    }
  }
}
