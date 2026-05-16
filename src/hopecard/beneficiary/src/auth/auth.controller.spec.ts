import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController (Beneficiary)', () => {
  let controller: AuthController;
  const mockService = {
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
