import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Reflector } from '@nestjs/core';

const mockAuthService = {
  login: jest.fn(),
  getProfile: jest.fn(),
  forgotPassword: jest.fn(),
  verifyOtp: jest.fn(),
  resetPassword: jest.fn(),
  register: jest.fn(),
};

describe('AuthController (bayanihub-enduser)', () => {
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
    it('should call authService.login and return a token with persona=enduser system=bayanihub', async () => {
      const expected = {
        access_token: 'jwt-token',
        user: { id: 'uid', email: 'user@bh.com', profile: { role: 'end_user' } },
      };
      mockAuthService.login.mockResolvedValue(expected);
      const result = await controller.login({ email: 'user@bh.com', password: 'password' });
      expect(result).toBe(expected);
      expect(result.access_token).toBeDefined();
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword and return a message', async () => {
      mockAuthService.forgotPassword.mockResolvedValue({ message: 'If that email is registered, a code has been sent.' });
      const result = await controller.forgotPassword({ email: 'user@bh.com' });
      expect(result).toHaveProperty('message');
    });
  });

  describe('verifyOtp', () => {
    it('should call authService.verifyOtp', async () => {
      mockAuthService.verifyOtp.mockResolvedValue({ verified: true });
      const result = await controller.verifyOtp({ email: 'user@bh.com', code: '123456' });
      expect(result.verified).toBe(true);
    });
  });
});
