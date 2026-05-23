import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { PersonaGuard } from './persona.guard';

function mockContext(user?: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function createGuard(expectedPersona: string, expectedSystem: string) {
  const reflector = {
    get: jest.fn().mockReturnValue({ expectedPersona, expectedSystem }),
  } as any;
  return new PersonaGuard(reflector);
}

describe('PersonaGuard', () => {
  describe('when user is missing', () => {
    it('throws ForbiddenException with INVALID_CLAIMS when no user', () => {
      const guard = createGuard('donor', 'hopecard');
      expect(() => guard.canActivate(mockContext(undefined))).toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException with INVALID_CLAIMS when user has no persona', () => {
      const guard = createGuard('donor', 'hopecard');
      expect(() =>
        guard.canActivate(mockContext({ system: 'hopecard' })),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException with INVALID_CLAIMS when user has no system', () => {
      const guard = createGuard('donor', 'hopecard');
      expect(() =>
        guard.canActivate(mockContext({ persona: 'donor' })),
      ).toThrow(ForbiddenException);
    });
  });

  describe('when persona or system does not match', () => {
    it('throws ForbiddenException with PERSONA_MISMATCH when persona is wrong', () => {
      const guard = createGuard('admin', 'hopecard');
      expect(() =>
        guard.canActivate(
          mockContext({ persona: 'donor', system: 'hopecard' }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException with PERSONA_MISMATCH when system is wrong', () => {
      const guard = createGuard('donor', 'hopecard');
      expect(() =>
        guard.canActivate(
          mockContext({ persona: 'donor', system: 'other-system' }),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('when persona and system match', () => {
    it('returns true', () => {
      const guard = createGuard('donor', 'hopecard');
      const result = guard.canActivate(
        mockContext({ persona: 'donor', system: 'hopecard' }),
      );
      expect(result).toBe(true);
    });
  });
});
