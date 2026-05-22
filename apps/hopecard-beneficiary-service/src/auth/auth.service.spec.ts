import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProcedureEventService } from '@app/api-center';
import { AuthService } from './auth.service';

// ── ProcedureEventService mock ────────────────────────────────────────────────
const mockEmit = jest.fn();

// ── jose mock (ESM-only) ─────────────────────────────────────────────────────
const mockJoseSign = jest.fn().mockResolvedValue('beneficiary.jwt.token');
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
const mockMaybeSingle = jest.fn();
const mockInsert = jest.fn();
const mockUpdateChain = { eq: jest.fn().mockReturnThis() };
const mockDeleteChain = { eq: jest.fn().mockReturnThis() };
const mockSupabaseChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  delete: jest.fn(() => mockDeleteChain),
  update: jest.fn(() => mockUpdateChain),
  maybeSingle: mockMaybeSingle,
  insert: mockInsert,
};
const mockSignInWithPassword = jest.fn();
const mockAuthAdmin = { updateUserById: jest.fn() };
const mockSupabase = {
  from: jest.fn(() => mockSupabaseChain),
  auth: { signInWithPassword: mockSignInWithPassword, admin: mockAuthAdmin },
};
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// ── nodemailer mock ──────────────────────────────────────────────────────────
const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

// ── jsonwebtoken mock ────────────────────────────────────────────────────────
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));
const jwtMod = require('jsonwebtoken') as { sign: jest.Mock; verify: jest.Mock };

describe('AuthService (Beneficiary)', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    capturedJosePayload = {};
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';
    process.env.JWT_SECRET = 'test-secret';
    process.env.RESET_TOKEN_SECRET = 'test-secret';
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASSWORD = 'p';
    process.env.SMTP_FROM = 'noreply@test.com';

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockDeleteChain.eq.mockReturnThis();
    mockUpdateChain.eq.mockResolvedValue({ data: null, error: null });
    mockSignInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'default' } });

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
    mockJoseSign.mockResolvedValue('beneficiary.jwt.token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ProcedureEventService, useValue: { emit: mockEmit } },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  // ── login ───────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns token with persona:beneficiary and system:hopecard on success', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-b1', email: 'ben@test.com' } },
        error: null,
      });
      mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'profile-1' }, error: null });

      const result = await service.login('ben@test.com', 'pass123');

      expect(result.success).toBe(true);
      expect(result.token).toBe('beneficiary.jwt.token');
      expect(capturedJosePayload.persona).toBe('beneficiary');
      expect(capturedJosePayload.system).toBe('hopecard');
      expect(capturedJosePayload.sub).toBe('uid-b1');
    });

    it('throws UnauthorizedException when Supabase signIn fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      });
      await expect(service.login('x@y.com', 'bad')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when beneficiary_profiles row not found', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-b2', email: 'x@y.com' } },
        error: null,
      });
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.login('x@y.com', 'pass')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws InternalServerErrorException on DB error during profile lookup', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-b3', email: 'x@y.com' } },
        error: null,
      });
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
      await expect(service.login('x@y.com', 'pass')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ── forgotPassword ──────────────────────────────────────────────────────────
  describe('forgotPassword', () => {
    it('returns success when email exists and OTP is sent', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockInsert.mockResolvedValueOnce({ error: null });
      mockSendMail.mockResolvedValue({ messageId: 'msg-1' });

      const result = await service.forgotPassword('test@email.com');
      expect(result.success).toBe(true);
      expect(result.message).toContain('verification code');
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.forgotPassword('nobody@email.com')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws InternalServerErrorException on profile DB error', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB err' } });
      await expect(service.forgotPassword('x@y.com')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws InternalServerErrorException when OTP insert fails', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockInsert.mockResolvedValueOnce({ error: { message: 'insert fail' } });
      await expect(service.forgotPassword('x@y.com')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws InternalServerErrorException when email sending fails', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockInsert.mockResolvedValueOnce({ error: null });
      mockSendMail.mockRejectedValue(new Error('SMTP error'));
      await expect(service.forgotPassword('x@y.com')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ── verifyResetOtp ──────────────────────────────────────────────────────────
  describe('verifyResetOtp', () => {
    it('returns a signed reset token on valid OTP', async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: 'otp-1', expires_at_ms: Date.now() + 60_000 },
        error: null,
      });
      mockUpdateChain.eq.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.verifyResetOtp('x@y.com', '123456');
      expect(result.reset_token).toBeDefined();
      expect(typeof result.reset_token).toBe('string');
      // Token should be base64-encoded JSON with email, verified, timestamp
      const decoded = JSON.parse(Buffer.from(result.reset_token, 'base64').toString('utf-8'));
      expect(decoded.email).toBe('x@y.com');
      expect(decoded.verified).toBe(true);
      expect(decoded.timestamp).toBeDefined();
    });

    it('throws InternalServerErrorException on DB error', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'err' } });
      await expect(service.verifyResetOtp('x@y.com', '123456')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws BadRequestException when OTP is not found', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.verifyResetOtp('x@y.com', 'bad')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when OTP is expired', async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: 'otp-2', expires_at_ms: Date.now() - 1 },
        error: null,
      });
      await expect(service.verifyResetOtp('x@y.com', '123456')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── resetPassword ────────────────────────────────────────────────────────────
  describe('resetPassword', () => {
    it('resets password successfully with valid token', async () => {
      const tokenData = { email: 'x@y.com', verified: true, timestamp: Date.now() };
      const validToken = Buffer.from(JSON.stringify(tokenData)).toString('base64');
      mockMaybeSingle.mockResolvedValueOnce({ data: { auth_user_id: 'auth-uid-1' }, error: null });
      mockAuthAdmin.updateUserById.mockResolvedValue({ error: null });

      const result = await service.resetPassword(validToken, 'NewPass123!');
      expect(result.success).toBe(true);
    });

    it('throws UnauthorizedException on invalid base64 token', async () => {
      await expect(service.resetPassword('invalid-token', 'pass')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException on malformed token data', async () => {
      const badToken = Buffer.from(JSON.stringify({ email: 'x@y.com', verified: false })).toString('base64');
      await expect(service.resetPassword(badToken, 'pass')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when token is expired', async () => {
      const expiredTokenData = { email: 'x@y.com', verified: true, timestamp: Date.now() - (20 * 60 * 1000) };
      const expiredToken = Buffer.from(JSON.stringify(expiredTokenData)).toString('base64');
      await expect(service.resetPassword(expiredToken, 'pass')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws NotFoundException when profile is not found', async () => {
      const tokenData = { email: 'x@y.com', verified: true, timestamp: Date.now() };
      const validToken = Buffer.from(JSON.stringify(tokenData)).toString('base64');
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.resetPassword(validToken, 'pass')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws InternalServerErrorException when auth update fails', async () => {
      const tokenData = { email: 'x@y.com', verified: true, timestamp: Date.now() };
      const validToken = Buffer.from(JSON.stringify(tokenData)).toString('base64');
      mockMaybeSingle.mockResolvedValueOnce({ data: { auth_user_id: 'uid' }, error: null });
      mockAuthAdmin.updateUserById.mockResolvedValue({ error: { message: 'update fail' } });
      await expect(service.resetPassword(validToken, 'pass')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws NotFoundException on profile DB error', async () => {
      const tokenData = { email: 'x@y.com', verified: true, timestamp: Date.now() };
      const validToken = Buffer.from(JSON.stringify(tokenData)).toString('base64');
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'db err' } });
      await expect(service.resetPassword(validToken, 'pass')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
