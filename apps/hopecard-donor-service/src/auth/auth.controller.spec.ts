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
    it('calls googleGetAuthUrl with the derived callback URL and returns the result', async () => {
      mockAuthService.googleGetAuthUrl.mockResolvedValue({ url: 'https://accounts.google.com/...' });

      const req = { protocol: 'https', get: jest.fn().mockReturnValue('api.example.com') };
      const result = await controller.googleUrl(req);

      expect(mockAuthService.googleGetAuthUrl).toHaveBeenCalledWith(
        'https://api.example.com/hopecard/donor/auth/google/callback',
      );
      expect(result).toEqual({ url: 'https://accounts.google.com/...' });
    });
  });

  describe('googleCallback', () => {
    it('calls googleCallback with code and callback URL, then redirects 302', async () => {
      mockAuthService.googleCallback.mockResolvedValue({
        redirectUrl: 'https://app.example.com/auth/google/success?token=abc',
      });

      const req = {
        protocol: 'https',
        get: jest.fn().mockReturnValue('api.example.com'),
        query: { code: 'auth-code-xyz' },
      };
      const res = { redirect: jest.fn() };

      await controller.googleCallback(req, res as any);

      expect(mockAuthService.googleCallback).toHaveBeenCalledWith(
        'auth-code-xyz',
        'https://api.example.com/hopecard/donor/auth/google/callback',
      );
      expect(res.redirect).toHaveBeenCalledWith(302, 'https://app.example.com/auth/google/success?token=abc');
    });
  });
});
