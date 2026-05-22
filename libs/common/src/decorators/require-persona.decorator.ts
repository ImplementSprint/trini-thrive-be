import { UseGuards } from '@nestjs/common';
import { JwtGuard } from '../guards/jwt.guard';
import { PersonaGuard } from '../guards/persona.guard';

export const RequirePersona = (persona: string, system = 'hopecard') =>
  UseGuards(new JwtGuard(persona), new PersonaGuard(persona, system));
