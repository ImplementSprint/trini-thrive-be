import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { JwtPayload } from './jwt.guard';

export const PERSONA_META_KEY = 'persona_meta';

export interface PersonaMeta {
  expectedPersona: string;
  expectedSystem: string;
}

@Injectable()
export class PersonaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const meta = this.reflector.get<PersonaMeta>(
      PERSONA_META_KEY,
      ctx.getHandler(),
    );

    if (!meta) return true;

    const user = (ctx.switchToHttp().getRequest<Request>() as Request & { user?: JwtPayload }).user;

    if (!user?.persona || !user?.system) {
      throw new ForbiddenException({ code: 'INVALID_CLAIMS' });
    }

    if (
      user.persona !== meta.expectedPersona ||
      user.system !== meta.expectedSystem
    ) {
      throw new ForbiddenException({ code: 'PERSONA_MISMATCH' });
    }

    return true;
  }
}
