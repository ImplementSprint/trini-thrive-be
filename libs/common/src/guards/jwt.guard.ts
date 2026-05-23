import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { jwtVerify } from 'jose';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  persona: string;
  system: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

@Injectable()
export class JwtGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException({ code: 'MISSING_TOKEN' });
    }

    const secret = process.env['JWT_SECRET'];
    if (!secret) {
      throw new UnauthorizedException({ code: 'MISSING_TOKEN' });
    }

    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
      );
      (request as Request & { user: JwtPayload }).user =
        payload as unknown as JwtPayload;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN' });
    }

    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' && token ? token : null;
  }
}
