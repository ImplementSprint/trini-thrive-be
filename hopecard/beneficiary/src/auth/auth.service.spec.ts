import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';

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
const mockAuthAdmin = { updateUserById: jest.fn() };
const mockSupabase = {
  from: jest.fn(() => mockSupabaseChain),
  auth: { admin: mockAuthAdmin },
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
const mockSign = jest.fn();
const mockVerify = jest.fn();
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));
// Access via require so we can spy on them per-test
const jwtMod = require('jsonwebtoken') as { sign: jest.Mock; verify: jest.Mock };

describe('AuthService (Beneficiary)', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';
    process.env.RESET_TOKEN_SECRET = 'test-secret';
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASSWORD = 'p';
    process.env.SMTP_FROM = 'noreply@test.com';

    // Default mock returns so chains don't throw on await
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockDeleteChain.eq.mockReturnThis();
    mockUpdateChain.eq.mockResolvedValue({ data: null, error: null });

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();
    service = module.get<AuthService>(AuthService);
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
      jwtMod.sign.mockReturnValue('signed-token');

      const result = await service.verifyResetOtp('x@y.com', '123456');
      expect(result.reset_token).toBe('signed-token');
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

    it('throws InternalServerErrorException when RESET_TOKEN_SECRET is missing', async () => {
      delete process.env.RESET_TOKEN_SECRET;
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: 'otp-3', expires_at_ms: Date.now() + 60_000 },
        error: null,
      });
      mockUpdateChain.eq.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.verifyResetOtp('x@y.com', '123456')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ── resetPassword ────────────────────────────────────────────────────────────
  describe('resetPassword', () => {
    it('resets password successfully with valid token', async () => {
      jwtMod.verify.mockReturnValue({ sub: 'x@y.com', purpose: 'password_reset' });
      mockMaybeSingle.mockResolvedValueOnce({ data: { auth_user_id: 'auth-uid-1' }, error: null });
      mockAuthAdmin.updateUserById.mockResolvedValue({ error: null });

      const result = await service.resetPassword('valid-token', 'NewPass123!');
      expect(result.success).toBe(true);
    });

    it('throws InternalServerErrorException when RESET_TOKEN_SECRET is missing', async () => {
      delete process.env.RESET_TOKEN_SECRET;
      await expect(service.resetPassword('tok', 'pass')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws UnauthorizedException on invalid JWT', async () => {
      jwtMod.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.resetPassword('bad-token', 'pass')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when token purpose is wrong', async () => {
      jwtMod.verify.mockReturnValue({ sub: 'x@y.com', purpose: 'other' });
      await expect(service.resetPassword('tok', 'pass')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws NotFoundException when profile is not found', async () => {
      jwtMod.verify.mockReturnValue({ sub: 'x@y.com', purpose: 'password_reset' });
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.resetPassword('tok', 'pass')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws InternalServerErrorException when auth update fails', async () => {
      jwtMod.verify.mockReturnValue({ sub: 'x@y.com', purpose: 'password_reset' });
      mockMaybeSingle.mockResolvedValueOnce({ data: { auth_user_id: 'uid' }, error: null });
      mockAuthAdmin.updateUserById.mockResolvedValue({ error: { message: 'update fail' } });
      await expect(service.resetPassword('tok', 'pass')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws NotFoundException on profile DB error', async () => {
      jwtMod.verify.mockReturnValue({ sub: 'x@y.com', purpose: 'password_reset' });
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'db err' } });
      await expect(service.resetPassword('tok', 'pass')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
