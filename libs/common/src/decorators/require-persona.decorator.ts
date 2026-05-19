import { UseGuards } from '@nestjs/common';
import { JwtGuard } from '../guards/jwt.guard';

export const RequirePersona = (persona: string) => UseGuards(new JwtGuard(persona));
