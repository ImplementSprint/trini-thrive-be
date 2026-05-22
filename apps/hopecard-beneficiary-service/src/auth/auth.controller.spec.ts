import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// ── jose mock (ESM-only) ─────────────────────────────────────────────────────
jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock.jwt.token'),
  })),
}));

// ── Supabase mock ─────────────────────────────────────────────────────────────
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(),
    auth: { signInWithPassword: jest.fn(), admin: { updateUserById: jest.fn() } },
  })),
}));

// ── nodemailer mock ───────────────────────────────────────────────────────────
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn() })),
}));

// ── jsonwebtoken mock ─────────────────────────────────────────────────────────
jest.mock('jsonwebtoken', () => ({ sign: jest.fn(), verify: jest.fn() }));

describe('AuthController (Beneficiary)', () => {
  let controller: AuthController;
  const mockService = {
    login: jest.fn(),
    forgotPassword: jest.fn(),
    verifyResetOtp: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockService }],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  it('login delegates to service', async () => {
    mockService.login.mockResolvedValue({ success: true, token: 'tok' });
    const result = await controller.login({ email: 'a@b.com', password: 'pass' });
    expect(result).toEqual({ success: true, token: 'tok' });
    expect(mockService.login).toHaveBeenCalledWith('a@b.com', 'pass');
  });

  it('forgotPassword delegates to service', async () => {
    mockService.forgotPassword.mockResolvedValue({ success: true, message: 'sent' });
    const result = await controller.forgotPassword({ email: 'a@b.com' });
    expect(result).toEqual({ success: true, message: 'sent' });
    expect(mockService.forgotPassword).toHaveBeenCalledWith('a@b.com');
  });

  it('verifyResetOtp delegates to service', async () => {
    mockService.verifyResetOtp.mockResolvedValue({ reset_token: 'tok' });
    const result = await controller.verifyResetOtp({ email: 'a@b.com', otp: '123456' });
    expect(result).toEqual({ reset_token: 'tok' });
    expect(mockService.verifyResetOtp).toHaveBeenCalledWith('a@b.com', '123456');
  });

  it('resetPassword delegates to service', async () => {
    mockService.resetPassword.mockResolvedValue({ success: true });
    const result = await controller.resetPassword({ reset_token: 'tok', new_password: 'NewPass!' });
    expect(result).toEqual({ success: true });
    expect(mockService.resetPassword).toHaveBeenCalledWith('tok', 'NewPass!');
  });
});
