import { UseGuards } from '@nestjs/common';
import { JwtGuard } from '../guards/jwt.guard';

/**
 * Decorator to protect routes with persona-scoped JWT authentication
 * Usage: @RequirePersona('admin') on controller or method
 * Validates that JWT token has matching persona and system='hopecard'
 */
export const RequirePersona = (persona: string) => UseGuards(new JwtGuard(persona));
