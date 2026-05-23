import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Reflector } from '@nestjs/core';

const mockAuthService = {
  login: jest.fn(),
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
  resetPassword: jest.fn(),
};

describe('AuthController (bayanihub-sitemanager)', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        Reflector,
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should call authService.login and return a token with persona=site-manager', async () => {
      const expected = {
        access_token: 'jwt-token',
        user: { id: 'uid', email: 'siteman@bh.com', profile: { role: 'site_manager' } },
      };
      mockAuthService.login.mockResolvedValue(expected);
      const result = await controller.login({ email: 'siteman@bh.com', password: 'password' });
      expect(result).toBe(expected);
      expect(result.access_token).toBeDefined();
    });
  });

  describe('sendOtp', () => {
    it('should call authService.sendOtp', async () => {
      mockAuthService.sendOtp.mockResolvedValue({ success: true, message: 'OTP sent successfully' });
      const result = await controller.sendOtp({ email: 'siteman@bh.com' });
      expect(result.success).toBe(true);
    });
  });

  describe('verifyOtp', () => {
    it('should call authService.verifyOtp', async () => {
      mockAuthService.verifyOtp.mockResolvedValue({ success: true });
      const result = await controller.verifyOtp({ email: 'siteman@bh.com', otp: '123456' });
      expect(result.success).toBe(true);
    });
  });
});
