import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env['JWT_SECRET'] ?? '');

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  persona: string;
  system: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly expectedPersona?: string) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException({
        message: 'No JWT token provided',
        error: 'MISSING_TOKEN',
        code: 'MISSING_AUTH_TOKEN',
      });
    }

    let payload: JwtPayload;
    try {
      const verified = await jwtVerify(token, JWT_SECRET);
      payload = verified.payload as JwtPayload;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      let detail = 'Invalid or expired JWT token';
      if (msg.includes('signature')) detail = 'Invalid token signature';
      else if (msg.includes('exp')) detail = 'Token has expired';
      else if (msg.includes('malformed')) detail = 'Malformed token format';
      throw new UnauthorizedException({ message: detail, error: 'INVALID_TOKEN', code: 'INVALID_JWT' });
    }

    if (this.expectedPersona) {
      if (payload.persona !== this.expectedPersona || payload.system !== 'hopecard') {
        throw new ForbiddenException({ message: 'Persona mismatch', code: 'PERSONA_MISMATCH' });
      }
    }

    request.user = payload;
    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);
    if (request.cookies?.admin_token) return request.cookies.admin_token;
    return undefined;
  }
}
