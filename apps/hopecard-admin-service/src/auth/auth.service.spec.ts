import { AuthService } from './auth.service';

// jose is ESM-only; mock it to capture the payload passed to SignJWT
const mockSign = jest.fn().mockResolvedValue('mock.jwt.token');
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

jest.mock('@app/common/supabase-client', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      admin: { listUsers: jest.fn(), updateUserById: jest.fn() },
    },
    from: jest.fn(),
  },
}));

jest.mock('@app/common/email', () => ({
  sendOTPEmail: jest.fn().mockResolvedValue(true),
}));

// Helpers to get typed mocks
const getSupabase = () =>
  (require('@app/common/supabase-client') as { supabase: any }).supabase;
const getSendOTPEmail = () =>
  (require('@app/common/email') as { sendOTPEmail: jest.Mock }).sendOTPEmail;

// OTP chain builder — covers both the "test query" (limit) and "full query" (gt)
const makeOtpChain = (otpData: any[] | null, otpError: any = null) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue({ data: otpData, error: null }),
  gt: jest.fn().mockResolvedValue({ data: otpData, error: otpError }),
  update: jest.fn().mockReturnThis(),
});

describe('AuthService (admin-auth)', () => {
  let service: AuthService;

  beforeEach(() => {
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
    mockSign.mockResolvedValue('mock.jwt.token');

    service = new AuthService();
  });

  // ── generateOTP ────────────────────────────────────────────────────────────
  describe('generateOTP', () => {
    it('returns a 6-digit string', () => {
      const otp = service.generateOTP();
      expect(otp).toMatch(/^\d{6}$/);
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns success:false when Supabase auth fails', async () => {
      const s = getSupabase();
      s.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Bad credentials' } });

      const result = await service.login('admin@test.com', 'wrong');
      expect(result.success).toBe(false);
      expect((result as any).error).toBe('Invalid email or password');
    });

    it('returns success:false when OTP insert fails', async () => {
      const s = getSupabase();
      s.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-1', email: 'admin@test.com', user_metadata: {} } }, error: null,
      });
      s.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ error: { message: 'DB insert fail' } }),
      });

      const result = await service.login('admin@test.com', 'pw');
      expect(result.success).toBe(false);
      expect((result as any).error).toBe('Failed to generate OTP');
    });

    it('returns success:false when OTP email fails', async () => {
      const s = getSupabase();
      s.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-1', email: 'admin@test.com', user_metadata: {} } }, error: null,
      });
      s.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });
      getSendOTPEmail().mockResolvedValue(false);

      const result = await service.login('admin@test.com', 'pw');
      expect(result.success).toBe(false);
      expect((result as any).error).toBe('Failed to send OTP email');
    });

    it('returns success:true and requiresOtp when login+OTP succeeds', async () => {
      const s = getSupabase();
      s.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-1', email: 'admin@test.com', user_metadata: { name: 'Admin' } } }, error: null,
      });
      s.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });
      getSendOTPEmail().mockResolvedValue(true);

      const result = await service.login('admin@test.com', 'pw');
      expect(result.success).toBe(true);
      expect((result as any).requiresOtp).toBe(true);
    });

    it('returns success:false on unexpected exception', async () => {
      const s = getSupabase();
      s.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));

      const result = await service.login('admin@test.com', 'pw');
      expect(result.success).toBe(false);
    });
  });

  // ── verifyOTP ──────────────────────────────────────────────────────────────
  describe('verifyOTP', () => {
    it('issues a token containing persona:admin and system:hopecard', async () => {
      const s = getSupabase();
      const otpRecord = { id: '1', email: 'admin@test.com', otp: '123456', used: false };

      s.from.mockImplementation(() => makeOtpChain([otpRecord]));
      s.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'user-uuid-123', email: 'admin@test.com', user_metadata: { name: 'Test Admin' } }] },
        error: null,
      });

      const result = await service.verifyOTP('admin@test.com', '123456');

      expect(result.success).toBe(true);
      expect(result.token).toBe('mock.jwt.token');
      expect(capturedPayload['persona']).toBe('admin');
      expect(capturedPayload['system']).toBe('hopecard');
      expect(capturedPayload['sub']).toBe('user-uuid-123');
      expect(capturedPayload['email']).toBe('admin@test.com');
    });

    it('returns success:false when OTP query returns an error', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => makeOtpChain(null, { message: 'DB error', code: '500', details: '', hint: '' }));

      const result = await service.verifyOTP('admin@test.com', '123456');
      expect(result.success).toBe(false);
      expect((result as any).error).toBe('Invalid or expired OTP');
    });

    it('returns success:false when OTP not found', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => makeOtpChain([]));

      const result = await service.verifyOTP('admin@test.com', 'wrong-otp');
      expect(result.success).toBe(false);
      expect((result as any).error).toBe('Invalid or expired OTP');
    });

    it('uses fallback adminData when listUsers fails', async () => {
      const s = getSupabase();
      const otpRecord = { id: '1', email: 'admin@test.com', otp: '123456', used: false };
      s.from.mockImplementation(() => makeOtpChain([otpRecord]));
      s.auth.admin.listUsers.mockResolvedValue({ data: null, error: { message: 'Auth error' } });

      const result = await service.verifyOTP('admin@test.com', '123456');
      expect(result.success).toBe(true);
      expect(capturedPayload['sub']).toBe('unknown');
    });

    it('returns success:false when user not found in auth', async () => {
      const s = getSupabase();
      const otpRecord = { id: '1', email: 'admin@test.com', otp: '123456', used: false };
      s.from.mockImplementation(() => makeOtpChain([otpRecord]));
      s.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'other-uid', email: 'other@test.com', user_metadata: {} }] },
        error: null,
      });

      const result = await service.verifyOTP('admin@test.com', '123456');
      expect(result.success).toBe(false);
      expect((result as any).error).toBe('User not found');
    });

    it('returns success:false on unexpected exception in outer try', async () => {
      const s = getSupabase();
      const otpRecord = { id: '1', email: 'admin@test.com', otp: '123456', used: false };
      s.from.mockImplementation(() => makeOtpChain([otpRecord]));
      s.auth.admin.listUsers.mockRejectedValue(new Error('Unexpected'));

      const result = await service.verifyOTP('admin@test.com', '123456');
      expect(result.success).toBe(false);
    });
  });

  // ── changePassword ─────────────────────────────────────────────────────────
  describe('changePassword', () => {
    it('returns success:false when current password is wrong', async () => {
      const s = getSupabase();
      s.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Wrong password' } });

      const result = await service.changePassword('admin@test.com', 'old', 'new');
      expect(result.success).toBe(false);
      expect((result as any).error).toBe('Current password is incorrect');
    });

    it('returns success:false when password update fails', async () => {
      const s = getSupabase();
      s.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-1' } }, error: null,
      });
      s.auth.admin.updateUserById.mockResolvedValue({ error: { message: 'Update failed' } });

      const result = await service.changePassword('admin@test.com', 'old', 'new');
      expect(result.success).toBe(false);
      expect((result as any).error).toBe('Failed to update password in Supabase');
    });

    it('returns success:true when password changed', async () => {
      const s = getSupabase();
      s.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-1' } }, error: null,
      });
      s.auth.admin.updateUserById.mockResolvedValue({ error: null });

      const result = await service.changePassword('admin@test.com', 'old', 'new');
      expect(result.success).toBe(true);
    });

    it('returns success:false on unexpected exception', async () => {
      const s = getSupabase();
      s.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));

      const result = await service.changePassword('admin@test.com', 'old', 'new');
      expect(result.success).toBe(false);
    });
  });
});
