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

const mockAuthService = {
  login: jest.fn(),
  signup: jest.fn(),
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
  generateOtp: jest.fn(),
  verifyNumericOtp: jest.fn(),
  checkEmail: jest.fn(),
  resetPasswordWithOtp: jest.fn(),
  updatePassword: jest.fn(),
  uploadId: jest.fn(),
  googleGetAuthUrl: jest.fn(),
  googleCallback: jest.fn(),
};

describe('AuthController (donor)', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  describe('googleUrl', () => {
    it('calls googleGetAuthUrl with the frontend callback URL and returns the result', async () => {
      process.env['NEXT_PUBLIC_APP_URL'] = 'https://app.example.com';
      mockAuthService.googleGetAuthUrl.mockResolvedValue({ url: 'https://accounts.google.com/...' });

      const result = await controller.googleUrl();

      expect(mockAuthService.googleGetAuthUrl).toHaveBeenCalledWith(
        'https://app.example.com/donor/auth/google/callback',
      );
      expect(result).toEqual({ url: 'https://accounts.google.com/...' });
    });
  });

  describe('googleCallback', () => {
    it('calls googleCallback with code and frontend callback URL, then redirects 302', async () => {
      process.env['NEXT_PUBLIC_APP_URL'] = 'https://app.example.com';
      mockAuthService.googleCallback.mockResolvedValue({
        redirectUrl: 'https://app.example.com/donor/auth/google/success?token=abc',
      });

      const req = { query: { code: 'auth-code-xyz' } };
      const res = { redirect: jest.fn() };

      await controller.googleCallback(req, res as any);

      expect(mockAuthService.googleCallback).toHaveBeenCalledWith(
        'auth-code-xyz',
        'https://app.example.com/donor/auth/google/callback',
      );
      expect(res.redirect).toHaveBeenCalledWith(302, 'https://app.example.com/donor/auth/google/success?token=abc');
    });
  });
});
