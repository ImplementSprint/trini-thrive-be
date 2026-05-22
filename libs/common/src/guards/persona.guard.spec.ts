import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { PersonaGuard } from './persona.guard';

function mockContext(user?: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PersonaGuard', () => {
  describe('when user is missing', () => {
    it('throws ForbiddenException with INVALID_CLAIMS when no user', () => {
      const guard = new PersonaGuard('donor', 'hopecard');
      expect(() => guard.canActivate(mockContext(undefined))).toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException with INVALID_CLAIMS when user has no persona', () => {
      const guard = new PersonaGuard('donor', 'hopecard');
      expect(() =>
        guard.canActivate(mockContext({ system: 'hopecard' })),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException with INVALID_CLAIMS when user has no system', () => {
      const guard = new PersonaGuard('donor', 'hopecard');
      expect(() =>
        guard.canActivate(mockContext({ persona: 'donor' })),
      ).toThrow(ForbiddenException);
    });
  });

  describe('when persona or system does not match', () => {
    it('throws ForbiddenException with PERSONA_MISMATCH when persona is wrong', () => {
      const guard = new PersonaGuard('admin', 'hopecard');
      expect(() =>
        guard.canActivate(
          mockContext({ persona: 'donor', system: 'hopecard' }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException with PERSONA_MISMATCH when system is wrong', () => {
      const guard = new PersonaGuard('donor', 'hopecard');
      expect(() =>
        guard.canActivate(
          mockContext({ persona: 'donor', system: 'other-system' }),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('when persona and system match', () => {
    it('returns true', () => {
      const guard = new PersonaGuard('donor', 'hopecard');
      const result = guard.canActivate(
        mockContext({ persona: 'donor', system: 'hopecard' }),
      );
      expect(result).toBe(true);
    });
  });
});
