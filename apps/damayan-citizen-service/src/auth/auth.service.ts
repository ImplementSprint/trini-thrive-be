import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT } from 'jose';
import { SupabaseService } from '@app/supabase';
import { LoginDto } from './dto/login.dto';

const DAMAYAN_SYSTEM = 'damayan';
const CITIZEN_PERSONA = 'citizen';

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

  private withTimeout<T>(promise: Promise<T>, message: string, ms = 8000): Promise<T> {
    return Promise.race([
      promise,
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

    if (profile.role !== 'citizen') {
      throw new UnauthorizedException('Access restricted to citizen accounts');
    }

    if (profile.status === 'pending') {
      return { status: 'pending_approval', message: 'Your account is pending approval.' };
    }

    if (profile.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    const expiresIn = dto.rememberMe ? '30d' : '8h';
    const token = await new SignJWT({
      sub: userId,
      email: data.user.email,
      persona: CITIZEN_PERSONA,
      system: DAMAYAN_SYSTEM,
      role: profile.role,
      profileId: profile.id,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(expiresIn)
      .sign(this.getJwtSecret());

    return { status: 'success', token, profile };
  }

  async signup(dto: { email: string; password: string; firstName: string; lastName: string; phone?: string }) {
    const supabase = this.getClient();
    const { data, error } = await supabase.auth.signUp({ email: dto.email, password: dto.password });
    if (error) throw new BadRequestException(error.message);

    const userId = data.user?.id;
    if (!userId) throw new BadRequestException('Signup failed');

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        auth_user_id: userId,
        first_name: dto.firstName,
        last_name: dto.lastName,
        phone: dto.phone,
        role: 'citizen',
        status: 'pending',
      })
      .select()
      .maybeSingle();

    if (profileError) throw new BadRequestException(profileError.message);
    return { status: 'pending_approval', message: 'Account created and pending approval.', profile };
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
}
