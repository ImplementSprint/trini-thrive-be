import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, RecoveryMethod } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-jwt-token'),
  })),
}));

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const dto: LoginDto = { email: 'test@test.com', password: 'password', rememberMe: false };
      const expectedResult = { access_token: 'token', message: 'Success' } as any;
      mockAuthService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(dto);
      expect(result).toEqual(expectedResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('getProfile', () => {
    it('should get profile', async () => {
      const req = { user: { sub: 'user-id' } };
      const expectedResult = { user: { id: 'user-id' } } as any;
      mockAuthService.getProfile.mockResolvedValue(expectedResult);

      const result = await controller.getProfile(req);
      expect(result).toEqual(expectedResult);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('user-id');
    });
  });

  describe('updateProfile', () => {
    it('should update profile', async () => {
      const req = { user: { sub: 'user-id' } };
      const dto: UpdateProfileDto = { firstName: 'Updated' };
      const expectedResult = { user: { id: 'user-id', firstName: 'Updated' } } as any;
      mockAuthService.updateProfile.mockResolvedValue(expectedResult);

      const result = await controller.updateProfile(req, dto);
      expect(result).toEqual(expectedResult);
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith('user-id', dto);
    });
  });

  describe('forgotPassword', () => {
    it('should request password reset', async () => {
      const dto: ForgotPasswordDto = { contact: 'test@test.com', method: RecoveryMethod.EMAIL };
      const expectedResult = { message: 'Sent' } as any;
      mockAuthService.forgotPassword.mockResolvedValue(expectedResult);

      const result = await controller.forgotPassword(dto);
      expect(result).toEqual(expectedResult);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto);
    });
  });

  describe('resetPassword', () => {
    it('should reset password', async () => {
      const dto: ResetPasswordDto = { contact: 'test@test.com', newPassword: 'new-password', code: '1234' };
      const expectedResult = { message: 'Reset' } as any;
      mockAuthService.resetPassword.mockResolvedValue(expectedResult);

      const result = await controller.resetPassword(dto);
      expect(result).toEqual(expectedResult);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
    });
  });
});
