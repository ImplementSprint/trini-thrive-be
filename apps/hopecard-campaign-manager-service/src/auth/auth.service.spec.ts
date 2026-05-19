import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

// ── jose mock (ESM-only) ─────────────────────────────────────────────────────
const mockJoseSign = jest.fn().mockResolvedValue('cm.jwt.token');
const mockSetExpirationTime = jest.fn().mockReturnThis();
const mockSetProtectedHeader = jest.fn().mockReturnThis();
let capturedJosePayload: Record<string, unknown> = {};

jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
    capturedJosePayload = payload;
    return {
      setProtectedHeader: mockSetProtectedHeader,
      setExpirationTime: mockSetExpirationTime,
      sign: mockJoseSign,
    };
  }),
}));

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockSignInWithPassword = jest.fn();
const mockFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { signInWithPassword: mockSignInWithPassword },
    from: mockFrom,
  })),
}));

function selectChain(result: { data: any; error: any }) {
  const c: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return c;
}

const mockConfigService = {
  get: (k: string) =>
    ({
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
      JWT_SECRET: 'test-secret',
    })[k],
};

describe('AuthService (CM)', () => {
  let service: AuthService;

  beforeEach(async () => {
    mockFrom.mockReset();
    mockSignInWithPassword.mockReset();
    capturedJosePayload = {};
    jest.clearAllMocks();

    const { SignJWT } = require('jose') as { SignJWT: jest.Mock };
    SignJWT.mockImplementation((payload: Record<string, unknown>) => {
      capturedJosePayload = payload;
      return {
        setProtectedHeader: mockSetProtectedHeader,
        setExpirationTime: mockSetExpirationTime,
        sign: mockJoseSign,
      };
    });
    mockSetProtectedHeader.mockReturnThis();
    mockSetExpirationTime.mockReturnThis();
    mockJoseSign.mockResolvedValue('cm.jwt.token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    (service as any).supabase = {
      auth: { signInWithPassword: mockSignInWithPassword },
      from: mockFrom,
    };
  });

  // ── login ───────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns token with persona:cm and system:hopecard on success', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'cm-uid-1', email: 'cm@test.com' } },
        error: null,
      });
      mockFrom.mockReturnValue(selectChain({ data: { id: 'profile-1' }, error: null }));

      const result = await service.login('cm@test.com', 'pass123');

      expect(result.success).toBe(true);
      expect(result.token).toBe('cm.jwt.token');
      expect(capturedJosePayload.persona).toBe('cm');
      expect(capturedJosePayload.system).toBe('hopecard');
      expect(capturedJosePayload.sub).toBe('cm-uid-1');
    });

    it('throws UnauthorizedException when Supabase signIn fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' },
      });
      await expect(service.login('x@y.com', 'bad')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when campaign_manager_profiles row not found', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'cm-uid-2', email: 'x@y.com' } },
        error: null,
      });
      mockFrom.mockReturnValue(selectChain({ data: null, error: null }));
      await expect(service.login('x@y.com', 'pass')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws InternalServerErrorException on DB error during profile lookup', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'cm-uid-3', email: 'x@y.com' } },
        error: null,
      });
      mockFrom.mockReturnValue(selectChain({ data: null, error: { message: 'DB err' } }));
      await expect(service.login('x@y.com', 'pass')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ── getManagerProfile ───────────────────────────────────────────────────────
  describe('getManagerProfile', () => {
    it('returns profile data on success', async () => {
      mockFrom.mockReturnValueOnce(
        selectChain({ data: { first_name: 'Jane' }, error: null }),
      );
      const result = await service.getManagerProfile('uid-1');
      expect(result).toEqual({ first_name: 'Jane' });
      expect(mockFrom).toHaveBeenCalledWith('campaign_manager_profiles');
    });

    it('throws InternalServerErrorException on DB error', async () => {
      mockFrom.mockReturnValueOnce(
        selectChain({ data: null, error: { message: 'DB failure' } }),
      );
      await expect(service.getManagerProfile('uid-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ── getBeneficiaryProfiles ──────────────────────────────────────────────────
  describe('getBeneficiaryProfiles', () => {
    it('fetches all profiles without status filter', async () => {
      const c: any = {
        select: jest.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      };
      mockFrom.mockReturnValueOnce(c);
      const result = await service.getBeneficiaryProfiles();
      expect(result).toEqual([{ id: '1' }]);
    });

    it('filters by status when provided', async () => {
      const c: any = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [{ id: '2', status: 'approved' }], error: null }),
        }),
      };
      mockFrom.mockReturnValueOnce(c);
      const result = await service.getBeneficiaryProfiles('approved');
      expect(result).toEqual([{ id: '2', status: 'approved' }]);
    });

    it('throws InternalServerErrorException on DB error', async () => {
      const c: any = {
        select: jest.fn().mockResolvedValue({ data: null, error: { message: 'err' } }),
      };
      mockFrom.mockReturnValueOnce(c);
      await expect(service.getBeneficiaryProfiles()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('onModuleInit — missing env vars', () => {
    it('logs error and skips client creation when env vars absent', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mod = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
        ],
      }).compile();
      expect(mod.get<AuthService>(AuthService)).toBeDefined();
      spy.mockRestore();
    });
  });
});
