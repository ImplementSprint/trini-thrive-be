import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtGuard } from './jwt.guard';

jest.mock('jose', () => ({ jwtVerify: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockJwtVerify = require('jose').jwtVerify as jest.Mock;

function mockContext(authHeader?: string, cookies: Record<string, string> = {}) {
  const request: any = { headers: {}, cookies, user: undefined };
  if (authHeader) request.headers.authorization = authHeader;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtGuard', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    jest.clearAllMocks();
  });

  describe('no token', () => {
    it('throws UnauthorizedException with MISSING_AUTH_TOKEN', async () => {
      const guard = new JwtGuard();
      await expect(guard.canActivate(mockContext())).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('invalid token', () => {
    it('throws UnauthorizedException with INVALID_JWT', async () => {
      mockJwtVerify.mockRejectedValue(new Error('signature mismatch'));
      const guard = new JwtGuard();
      await expect(guard.canActivate(mockContext('Bearer bad.token'))).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('valid token, no expectedPersona', () => {
    it('passes and sets request.user', async () => {
      const payload = { sub: 'u1', email: 'a@b.com', persona: 'admin', system: 'hopecard' };
      mockJwtVerify.mockResolvedValue({ payload });
      const ctx = mockContext('Bearer valid.token');
      const guard = new JwtGuard();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(ctx.switchToHttp().getRequest().user).toEqual(payload);
    });
  });

  describe('valid token, expectedPersona matches', () => {
    it('passes when persona and system match', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'u1', email: 'a@b.com', persona: 'donor', system: 'hopecard' },
      });
      const guard = new JwtGuard('donor');
      const result = await guard.canActivate(mockContext('Bearer valid.token'));
      expect(result).toBe(true);
    });
  });

  describe('valid token, persona mismatch', () => {
    it('throws ForbiddenException with PERSONA_MISMATCH when persona is wrong', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'u1', email: 'a@b.com', persona: 'donor', system: 'hopecard' },
      });
      const guard = new JwtGuard('admin');
      await expect(guard.canActivate(mockContext('Bearer valid.token'))).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException with PERSONA_MISMATCH when system is wrong', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'u1', email: 'a@b.com', persona: 'admin', system: 'other-system' },
      });
      const guard = new JwtGuard('admin');
      await expect(guard.canActivate(mockContext('Bearer valid.token'))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cookie fallback', () => {
    it('reads token from admin_token cookie', async () => {
      const payload = { sub: 'u1', email: 'a@b.com', persona: 'admin', system: 'hopecard' };
      mockJwtVerify.mockResolvedValue({ payload });
      const guard = new JwtGuard();
      const result = await guard.canActivate(mockContext(undefined, { admin_token: 'cookie.token' }));
      expect(result).toBe(true);
    });
  });
});
