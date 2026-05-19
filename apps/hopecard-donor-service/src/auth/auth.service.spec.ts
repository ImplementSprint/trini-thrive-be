import { AuthService } from './auth.service';

// jose mock
const mockSign = jest.fn().mockResolvedValue('donor.jwt.token');
const mockSetExpirationTime = jest.fn().mockReturnThis();
const mockSetProtectedHeader = jest.fn().mockReturnThis();
let capturedPayload: Record<string, unknown> = {};

jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
    capturedPayload = payload;
    return {
      setProtectedHeader: mockSetProtectedHeader,
      setExpirationTime: mockSetExpirationTime,
      sign: mockSign,
    };
  }),
}));

// supabase mock
const mockSignInWithPassword = jest.fn();
const mockFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { signInWithPassword: mockSignInWithPassword },
    from: mockFrom,
  })),
}));

// nodemailer mock
jest.mock('nodemailer', () => ({
  default: { createTransport: jest.fn(() => ({ sendMail: jest.fn() })) },
}));

describe('AuthService (donor)', () => {
  let service: AuthService;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';
    process.env.JWT_SECRET = 'test-secret';
    capturedPayload = {};
    jest.clearAllMocks();

    const { SignJWT } = require('jose') as { SignJWT: jest.Mock };
    SignJWT.mockImplementation((payload: Record<string, unknown>) => {
      capturedPayload = payload;
      return {
        setProtectedHeader: mockSetProtectedHeader,
        setExpirationTime: mockSetExpirationTime,
        sign: mockSign,
      };
    });
    mockSetProtectedHeader.mockReturnThis();
    mockSetExpirationTime.mockReturnThis();
    mockSign.mockResolvedValue('donor.jwt.token');

    service = new AuthService();
  });

  describe('login', () => {
    const profileChain = () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { status: 'approved', role: 'buyer' }, error: null }),
      };
      return chain;
    };

    it('returns token with persona:donor and system:hopecard on successful login', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-1', email: 'donor@test.com' }, session: {} },
        error: null,
      });
      mockFrom.mockReturnValue(profileChain());

      const result = await service.login('donor@test.com', 'pass123');

      expect(result.success).toBe(true);
      expect(result.token).toBe('donor.jwt.token');
      expect(capturedPayload.persona).toBe('donor');
      expect(capturedPayload.system).toBe('hopecard');
      expect(capturedPayload.sub).toBe('uid-1');
    });

    it('throws 401 when Supabase signIn fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' },
      });
      await expect(service.login('x@y.com', 'bad')).rejects.toMatchObject({ status: 401 });
    });

    it('throws 403 when donor profile not found', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-2', email: 'x@y.com' }, session: {} },
        error: null,
      });
      const notFoundChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };
      mockFrom.mockReturnValue(notFoundChain);
      await expect(service.login('x@y.com', 'pass')).rejects.toMatchObject({ status: 403 });
    });

    it('throws 403 when donor account is not approved', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-3', email: 'x@y.com' }, session: {} },
        error: null,
      });
      const pendingChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { status: 'pending', role: 'buyer' }, error: null }),
      };
      mockFrom.mockReturnValue(pendingChain);
      await expect(service.login('x@y.com', 'pass')).rejects.toMatchObject({ status: 403 });
    });

    it('throws 500 when JWT_SECRET is not configured', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-4', email: 'x@y.com' }, session: {} },
        error: null,
      });
      mockFrom.mockReturnValue(profileChain());
      delete process.env.JWT_SECRET;
      await expect(service.login('x@y.com', 'pass')).rejects.toMatchObject({ status: 500 });
    });
  });
});
