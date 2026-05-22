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

  describe('login', () => {
    it('delegates to authService.login', async () => {
      mockAuthService.login.mockResolvedValue({ token: 'jwt' });
      const result = await controller.login({ email: 'a@b.com', password: 'pass' });
      expect(mockAuthService.login).toHaveBeenCalledWith('a@b.com', 'pass');
      expect(result).toEqual({ token: 'jwt' });
    });
  });

  describe('signup', () => {
    it('delegates to authService.signup with origin from request headers', async () => {
      mockAuthService.signup.mockResolvedValue({ id: '1' });
      const req = { headers: { origin: 'https://app.example.com' } };
      const result = await controller.signup({ name: 'Alice' }, req as any);
      expect(mockAuthService.signup).toHaveBeenCalledWith({
        name: 'Alice',
        origin: 'https://app.example.com',
      });
      expect(result).toEqual({ id: '1' });
    });
  });

  describe('sendOtp', () => {
    it('delegates to authService.sendOtp', async () => {
      mockAuthService.sendOtp.mockResolvedValue({ sent: true });
      const result = await controller.sendOtp({ email: 'a@b.com' });
      expect(mockAuthService.sendOtp).toHaveBeenCalledWith('a@b.com');
      expect(result).toEqual({ sent: true });
    });
  });

  describe('verifyOtp', () => {
    it('delegates to authService.verifyOtp', async () => {
      mockAuthService.verifyOtp.mockResolvedValue({ verified: true });
      const result = await controller.verifyOtp({ email: 'a@b.com', token: '123456', type: 'signup' });
      expect(mockAuthService.verifyOtp).toHaveBeenCalledWith('a@b.com', '123456', 'signup');
      expect(result).toEqual({ verified: true });
    });
  });

  describe('generateOtp', () => {
    it('delegates to authService.generateOtp', async () => {
      mockAuthService.generateOtp.mockResolvedValue({ generated: true });
      const result = await controller.generateOtp({ email: 'a@b.com' });
      expect(mockAuthService.generateOtp).toHaveBeenCalledWith('a@b.com');
      expect(result).toEqual({ generated: true });
    });
  });

  describe('verifyNumericOtp', () => {
    it('delegates to authService.verifyNumericOtp', async () => {
      mockAuthService.verifyNumericOtp.mockResolvedValue({ valid: true });
      const result = await controller.verifyNumericOtp({ email: 'a@b.com', code: '654321' });
      expect(mockAuthService.verifyNumericOtp).toHaveBeenCalledWith('a@b.com', '654321');
      expect(result).toEqual({ valid: true });
    });
  });

  describe('checkEmail', () => {
    it('delegates to authService.checkEmail', async () => {
      mockAuthService.checkEmail.mockResolvedValue({ exists: false });
      const result = await controller.checkEmail({ email: 'a@b.com' });
      expect(mockAuthService.checkEmail).toHaveBeenCalledWith('a@b.com');
      expect(result).toEqual({ exists: false });
    });
  });

  describe('resetPasswordWithOtp', () => {
    it('delegates to authService.resetPasswordWithOtp', async () => {
      mockAuthService.resetPasswordWithOtp.mockResolvedValue({ reset: true });
      const result = await controller.resetPasswordWithOtp({
        email: 'a@b.com',
        password: 'newPass',
        sessionToken: 'tok',
      });
      expect(mockAuthService.resetPasswordWithOtp).toHaveBeenCalledWith('a@b.com', 'newPass', 'tok');
      expect(result).toEqual({ reset: true });
    });
  });

  describe('updatePassword', () => {
    it('delegates to authService.updatePassword', async () => {
      mockAuthService.updatePassword.mockResolvedValue({ updated: true });
      const result = await controller.updatePassword({ password: 'newPass', accessToken: 'at' });
      expect(mockAuthService.updatePassword).toHaveBeenCalledWith('newPass', 'at');
      expect(result).toEqual({ updated: true });
    });
  });

  describe('uploadId', () => {
    it('delegates to authService.uploadId', async () => {
      mockAuthService.uploadId.mockResolvedValue({ url: 'https://storage/id.jpg' });
      const file = { originalname: 'id.jpg' } as Express.Multer.File;
      const result = await controller.uploadId(file, 'user-1');
      expect(mockAuthService.uploadId).toHaveBeenCalledWith(file, 'user-1');
      expect(result).toEqual({ url: 'https://storage/id.jpg' });
    });
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
