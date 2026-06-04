import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class InternalKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['x-internal-key'];
    const expected = process.env['INTERNAL_API_KEY'];
    if (!expected || key !== expected) {
      throw new UnauthorizedException('Invalid internal service key');
    }
    return true;
  }
}
