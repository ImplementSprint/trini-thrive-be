import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../guards/jwt.guard';
import { PersonaGuard, PERSONA_META_KEY } from '../guards/persona.guard';

export const RequirePersona = (persona: string, system: string) =>
  applyDecorators(
    SetMetadata(PERSONA_META_KEY, { expectedPersona: persona, expectedSystem: system }),
    UseGuards(JwtGuard, PersonaGuard),
  );
