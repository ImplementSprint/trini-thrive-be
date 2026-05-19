import { AuthService } from './auth.service';

// ── jose mock ─────────────────────────────────────────────────────────────────
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

// ── Supabase mock ─────────────────────────────────────────────────────────────
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockSetSession = jest.fn();
const mockUpdateUser = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockListUsers = jest.fn();
const mockUpdateUserById = jest.fn();
const mockFrom = jest.fn();
const mockStorageUpload = jest.fn();
const mockStorageGetPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl: 'https://storage/test.jpg' } });
const mockStorageBucket = { upload: mockStorageUpload, getPublicUrl: mockStorageGetPublicUrl };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
      setSession: mockSetSession,
      updateUser: mockUpdateUser,
      resetPasswordForEmail: mockResetPasswordForEmail,
      admin: { listUsers: mockListUsers, updateUserById: mockUpdateUserById },
    },
    from: mockFrom,
    storage: { from: jest.fn().mockReturnValue(mockStorageBucket) },
  })),
}));

// ── nodemailer mock ───────────────────────────────────────────────────────────
const mockSendMail = jest.fn();
jest.mock('nodemailer', () => {
  const mockCreate = jest.fn();
  return { __esModule: true, default: { createTransport: mockCreate } };
});

// ── helpers ───────────────────────────────────────────────────────────────────
const makeChain = (overrides: Record<string, any> = {}) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gt: jest.fn().mockResolvedValue({ data: [], error: null }),
  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  delete: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  ...overrides,
});

describe('AuthService (donor)', () => {
  let service: AuthService;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';
    process.env.JWT_SECRET = 'test-secret';
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'u@test.com';
    process.env.SMTP_PASSWORD = 'pass';
    process.env.SMTP_FROM = 'Hopecard';
    capturedPayload = {};
    jest.clearAllMocks();

    const { SignJWT } = require('jose') as { SignJWT: jest.Mock };
    SignJWT.mockImplementation((payload: Record<string, unknown>) => {
      capturedPayload = payload;
      return { setProtectedHeader: mockSetProtectedHeader, setExpirationTime: mockSetExpirationTime, sign: mockSign };
    });
    mockSetProtectedHeader.mockReturnThis();
    mockSetExpirationTime.mockReturnThis();
    mockSign.mockResolvedValue('donor.jwt.token');
    mockSendMail.mockResolvedValue({ messageId: 'msg-1' });
    mockStorageGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://storage/test.jpg' } });

    const nodemailerMod = require('nodemailer') as { default: { createTransport: jest.Mock } };
    nodemailerMod.default.createTransport.mockImplementation(() => ({ sendMail: mockSendMail }));

    service = new AuthService();
  });

  // ── login ──────────────────────────────────────────────────────────────────
  describe('login', () => {
    const profileChain = () => makeChain({
      single: jest.fn().mockResolvedValue({ data: { status: 'approved', role: 'buyer' }, error: null }),
    });

    it('returns token with persona:donor and system:hopecard on successful login', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-1', email: 'donor@test.com' }, session: {} }, error: null,
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
      mockSignInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid credentials' } });
      await expect(service.login('x@y.com', 'bad')).rejects.toMatchObject({ status: 401 });
    });

    it('throws 403 when donor profile not found', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-2', email: 'x@y.com' }, session: {} }, error: null,
      });
      mockFrom.mockReturnValue(makeChain({
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      }));
      await expect(service.login('x@y.com', 'pass')).rejects.toMatchObject({ status: 403 });
    });

    it('throws 403 when donor account is not approved', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-3', email: 'x@y.com' }, session: {} }, error: null,
      });
      mockFrom.mockReturnValue(makeChain({
        single: jest.fn().mockResolvedValue({ data: { status: 'pending', role: 'buyer' }, error: null }),
      }));
      await expect(service.login('x@y.com', 'pass')).rejects.toMatchObject({ status: 403 });
    });

    it('throws 500 when JWT_SECRET is not configured', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-4', email: 'x@y.com' }, session: {} }, error: null,
      });
      mockFrom.mockReturnValue(profileChain());
      delete process.env.JWT_SECRET;
      await expect(service.login('x@y.com', 'pass')).rejects.toMatchObject({ status: 500 });
    });
  });

  // ── signup ────────────────────────────────────────────────────────────────
  describe('signup', () => {
    it('throws 400 when required fields are missing', async () => {
      await expect(service.signup({ email: '', password: '', firstName: '', lastName: '' }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when supabase signUp fails', async () => {
      mockSignUp.mockResolvedValue({ data: { user: null }, error: { message: 'Email already in use' } });
      await expect(service.signup({ email: 'a@b.com', password: 'pw', firstName: 'A', lastName: 'B' }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('creates new profile via insert and returns success', async () => {
      mockSignUp.mockResolvedValue({ data: { user: { id: 'new-uid' } }, error: null });
      mockFrom.mockReturnValue(makeChain({
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      }));

      const result = await service.signup({ email: 'a@b.com', password: 'pw', firstName: 'A', lastName: 'B' });
      expect(result.success).toBe(true);
      expect(result.profileCreated).toBe(true);
    });

    it('updates existing profile when email already in digital_donor_profiles', async () => {
      mockSignUp.mockResolvedValue({ data: { user: { id: 'new-uid' } }, error: null });
      // First from() call: maybeSingle to check existing profile
      mockFrom.mockReturnValueOnce(makeChain({
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'existing-id' }, error: null }),
      }));
      // Second from() call: update existing profile — eq is the terminal (returns resolved promise)
      const updateChain: any = { update: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ error: null }) };
      mockFrom.mockReturnValueOnce(updateChain);

      const result = await service.signup({ email: 'a@b.com', password: 'pw', firstName: 'A', lastName: 'B' });
      expect(result.success).toBe(true);
    });

    it('returns warning when profile creation fails', async () => {
      mockSignUp.mockResolvedValue({ data: { user: { id: 'new-uid' } }, error: null });
      mockFrom.mockReturnValue(makeChain({
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockResolvedValue({ error: { message: 'DB error', code: '23505' } }),
      }));

      const result = await service.signup({ email: 'a@b.com', password: 'pw', firstName: 'A', lastName: 'B' });
      expect(result.success).toBe(true);
      expect(result.profileCreated).toBe(false);
      expect(result.warning).toBeDefined();
    });
  });

  // ── sendOtp ───────────────────────────────────────────────────────────────
  describe('sendOtp', () => {
    it('throws 400 when email is missing', async () => {
      await expect(service.sendOtp('')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when supabase signInWithOtp fails', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: { message: 'OTP error' } });
      await expect(service.sendOtp('x@y.com')).rejects.toMatchObject({ status: 400 });
    });

    it('returns success on valid email', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });
      const result = await service.sendOtp('x@y.com');
      expect(result.success).toBe(true);
    });
  });

  // ── verifyOtp ──────────────────────────────────────────────────────────────
  describe('verifyOtp', () => {
    it('throws 400 when email or token missing', async () => {
      await expect(service.verifyOtp('', '')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 401 when supabase verifyOtp fails', async () => {
      mockVerifyOtp.mockResolvedValue({ data: {}, error: { message: 'Invalid OTP' } });
      await expect(service.verifyOtp('x@y.com', 'bad-token')).rejects.toMatchObject({ status: 401 });
    });

    it('returns session on success', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { session: { access_token: 'tok' }, user: { id: 'u1' } }, error: null,
      });
      const result = await service.verifyOtp('x@y.com', 'valid-token');
      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
    });
  });

  // ── generateOtp ───────────────────────────────────────────────────────────
  describe('generateOtp', () => {
    it('throws 400 when email is missing', async () => {
      await expect(service.generateOtp('')).rejects.toMatchObject({ status: 400 });
    });

    it('sends OTP email and returns success', async () => {
      mockFrom.mockReturnValue(makeChain());
      const result = await service.generateOtp('x@y.com');
      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('throws 500 when email send fails with SMTP error', async () => {
      mockFrom.mockReturnValue(makeChain());
      const err: any = new Error('SMTP auth failed');
      err.responseCode = 535;
      mockSendMail.mockRejectedValue(err);
      await expect(service.generateOtp('x@y.com')).rejects.toMatchObject({ status: 500 });
    });

    it('throws 500 when email send fails with generic error', async () => {
      mockFrom.mockReturnValue(makeChain());
      mockSendMail.mockRejectedValue(new Error('Connection refused'));
      await expect(service.generateOtp('x@y.com')).rejects.toMatchObject({ status: 500 });
    });
  });

  // ── verifyNumericOtp ──────────────────────────────────────────────────────
  describe('verifyNumericOtp', () => {
    it('throws 400 when email or code missing', async () => {
      await expect(service.verifyNumericOtp('', '')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 404 when no active OTP session found', async () => {
      mockFrom.mockReturnValue(makeChain({
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      }));
      await expect(service.verifyNumericOtp('x@y.com', '123456')).rejects.toMatchObject({ status: 404 });
    });

    it('throws 410 when OTP is expired', async () => {
      mockFrom.mockReturnValue(makeChain({
        single: jest.fn().mockResolvedValue({
          data: { id: 'otp-1', otp: '123456', expires_at_ms: Date.now() - 1000 }, error: null,
        }),
      }));
      await expect(service.verifyNumericOtp('x@y.com', '123456')).rejects.toMatchObject({ status: 410 });
    });

    it('throws 401 when OTP code is wrong', async () => {
      mockFrom.mockReturnValue(makeChain({
        single: jest.fn().mockResolvedValue({
          data: { id: 'otp-1', otp: '999999', expires_at_ms: Date.now() + 60000 }, error: null,
        }),
      }));
      await expect(service.verifyNumericOtp('x@y.com', '123456')).rejects.toMatchObject({ status: 401 });
    });

    it('returns sessionToken on valid OTP', async () => {
      // First from(): select otp record
      mockFrom.mockReturnValueOnce(makeChain({
        single: jest.fn().mockResolvedValue({
          data: { id: 'otp-1', otp: '123456', expires_at_ms: Date.now() + 60000 }, error: null,
        }),
      }));
      // Second from(): update otp as used
      const updateChain: any = { update: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ error: null }) };
      mockFrom.mockReturnValueOnce(updateChain);

      const result = await service.verifyNumericOtp('x@y.com', '123456');
      expect(result.success).toBe(true);
      expect(result.sessionToken).toBeDefined();
    });
  });

  // ── checkEmail ────────────────────────────────────────────────────────────
  describe('checkEmail', () => {
    it('throws 400 when email is missing', async () => {
      await expect(service.checkEmail('')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 500 when listUsers fails', async () => {
      mockListUsers.mockResolvedValue({ data: null, error: { message: 'DB error' } });
      await expect(service.checkEmail('x@y.com')).rejects.toMatchObject({ status: 500 });
    });

    it('throws 404 when email not found', async () => {
      mockListUsers.mockResolvedValue({ data: { users: [{ email: 'other@test.com' }] }, error: null });
      await expect(service.checkEmail('x@y.com')).rejects.toMatchObject({ status: 404 });
    });

    it('returns exists:true when email found', async () => {
      mockListUsers.mockResolvedValue({ data: { users: [{ email: 'x@y.com' }] }, error: null });
      const result = await service.checkEmail('x@y.com');
      expect(result.success).toBe(true);
      expect(result.exists).toBe(true);
    });
  });

  // ── resetPasswordWithOtp ──────────────────────────────────────────────────
  describe('resetPasswordWithOtp', () => {
    it('throws 400 when email missing', async () => {
      await expect(service.resetPasswordWithOtp('', 'pw', 'tok')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when password missing', async () => {
      await expect(service.resetPasswordWithOtp('x@y.com', '', 'tok')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when sessionToken missing', async () => {
      await expect(service.resetPasswordWithOtp('x@y.com', 'pw', '')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 401 when sessionToken is invalid base64', async () => {
      await expect(service.resetPasswordWithOtp('x@y.com', 'pw', 'not-valid-base64!!')).rejects.toMatchObject({ status: 401 });
    });

    it('throws 401 when sessionToken email does not match', async () => {
      const badToken = Buffer.from(JSON.stringify({ email: 'other@y.com', verified: true })).toString('base64');
      await expect(service.resetPasswordWithOtp('x@y.com', 'pw', badToken)).rejects.toMatchObject({ status: 401 });
    });

    it('resets password via admin API when service key present', async () => {
      const token = Buffer.from(JSON.stringify({ email: 'x@y.com', verified: true })).toString('base64');
      mockListUsers.mockResolvedValue({ data: { users: [{ id: 'uid-1', email: 'x@y.com' }] }, error: null });
      mockUpdateUserById.mockResolvedValue({ error: null });

      const result = await service.resetPasswordWithOtp('x@y.com', 'newpass', token);
      expect(result.success).toBe(true);
    });

    it('throws 500 when listUsers fails during reset', async () => {
      const token = Buffer.from(JSON.stringify({ email: 'x@y.com', verified: true })).toString('base64');
      mockListUsers.mockResolvedValue({ data: null, error: { message: 'DB error' } });
      await expect(service.resetPasswordWithOtp('x@y.com', 'pw', token)).rejects.toMatchObject({ status: 500 });
    });
  });

  // ── updatePassword ────────────────────────────────────────────────────────
  describe('updatePassword', () => {
    it('throws 400 when password or accessToken missing', async () => {
      await expect(service.updatePassword('', '')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when supabase updateUser fails', async () => {
      mockSetSession.mockResolvedValue({});
      mockUpdateUser.mockResolvedValue({ data: {}, error: { message: 'Update failed' } });
      await expect(service.updatePassword('newpass', 'access-tok')).rejects.toMatchObject({ status: 400 });
    });

    it('returns success on valid update', async () => {
      mockSetSession.mockResolvedValue({});
      mockUpdateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
      const result = await service.updatePassword('newpass', 'access-tok');
      expect(result.success).toBe(true);
    });
  });

  // ── uploadId ──────────────────────────────────────────────────────────────
  describe('uploadId', () => {
    const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
      fieldname: 'file',
      originalname: 'id.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('test'),
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
      ...overrides,
    });

    it('throws 400 when no file provided', async () => {
      await expect(service.uploadId(null as any, 'uid-1')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when userId missing', async () => {
      await expect(service.uploadId(makeFile(), '')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when file type is invalid', async () => {
      await expect(service.uploadId(makeFile({ mimetype: 'text/plain' }), 'uid-1')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when file is too large', async () => {
      await expect(service.uploadId(makeFile({ size: 6 * 1024 * 1024 }), 'uid-1')).rejects.toMatchObject({ status: 400 });
    });

    it('returns url on successful upload', async () => {
      mockStorageUpload.mockResolvedValue({ data: { path: 'uid-1/123-valid-id.jpg' }, error: null });
      const result = await service.uploadId(makeFile(), 'uid-1');
      expect(result.success).toBe(true);
      expect(result.url).toBe('https://storage/test.jpg');
    });

    it('throws 503 when storage bucket not found', async () => {
      mockStorageUpload.mockResolvedValue({ data: null, error: { message: 'Bucket not found' } });
      await expect(service.uploadId(makeFile(), 'uid-1')).rejects.toMatchObject({ status: 503 });
    });

    it('throws 400 on other storage upload errors', async () => {
      mockStorageUpload.mockResolvedValue({ data: null, error: { message: 'Permission denied' } });
      await expect(service.uploadId(makeFile(), 'uid-1')).rejects.toMatchObject({ status: 400 });
    });
  });
});
