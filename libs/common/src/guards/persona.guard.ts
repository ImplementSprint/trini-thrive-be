import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class PersonaGuard implements CanActivate {
  constructor(
    private readonly expectedPersona: string,
    private readonly expectedSystem: string,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest().user;

    if (!user?.persona || !user?.system) {
      throw new ForbiddenException({ message: 'Access denied', code: 'INVALID_CLAIMS' });
    }

    if (user.persona !== this.expectedPersona || user.system !== this.expectedSystem) {
      throw new ForbiddenException({ message: 'Access denied', code: 'PERSONA_MISMATCH' });
    }

    return true;
  }
}
