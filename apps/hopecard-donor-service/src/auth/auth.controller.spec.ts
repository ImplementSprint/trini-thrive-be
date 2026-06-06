jest.mock('jose', () => ({ jwtVerify: jest.fn(), SignJWT: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({})) }));
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: jest.fn() })) }));
jest.mock('@implementsprint/sdk', () => ({ TribeClient: jest.fn() }));
jest.mock('@app/common/supabase-client', () => ({ supabase: {} }));
jest.mock('@app/common/supabase-helpers', () => ({ supabaseRequest: jest.fn(), supabase: {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockService = {
  uploadId: jest.fn(),
  signup: jest.fn(),
  login: jest.fn(),
  forgotPassword: jest.fn(),
  verifyOtp: jest.fn(),
  resetPassword: jest.fn(),
  googleGetAuthUrl: jest.fn(),
  googleCallback: jest.fn(),
};

const req = { user: { sub: 'user-uuid' } } as any;

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockService }],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  it('uploadId delegates file and user sub', async () => {
    const file = { originalname: 'id.jpg', size: 100 } as any;
    mockService.uploadId.mockResolvedValue({ path: 'user-uuid/id.jpg' });
    const result = await controller.uploadId(req, file);
    expect(mockService.uploadId).toHaveBeenCalledWith(file, 'user-uuid');
    expect(result).toEqual({ path: 'user-uuid/id.jpg' });
  });

  it('signup delegates dto', async () => {
    const dto = { email: 'a@b.com', password: 'pass1234', first_name: 'A', last_name: 'B' } as any;
    mockService.signup.mockResolvedValue({ success: true, message: 'Account created' });
    const result = await controller.signup(dto);
    expect(mockService.signup).toHaveBeenCalledWith(dto);
    expect(result).toMatchObject({ success: true });
  });

  it('login delegates email and password', async () => {
    const dto = { email: 'a@b.com', password: 'pass1234' } as any;
    mockService.login.mockResolvedValue({ success: true, token: 'tok', session: {}, status: 'active' });
    const result = await controller.login(dto);
    expect(mockService.login).toHaveBeenCalledWith(dto.email, dto.password);
    expect(result).toMatchObject({ success: true });
  });

  it('forgotPassword delegates email', async () => {
    const dto = { email: 'a@b.com' } as any;
    mockService.forgotPassword.mockResolvedValue({ success: true, message: 'OTP sent' });
    const result = await controller.forgotPassword(dto);
    expect(mockService.forgotPassword).toHaveBeenCalledWith(dto.email);
    expect(result).toMatchObject({ success: true });
  });

  it('verifyOtp delegates email and otp', async () => {
    const dto = { email: 'a@b.com', otp: '123456' } as any;
    mockService.verifyOtp.mockResolvedValue({ reset_token: 'tok' });
    const result = await controller.verifyOtp(dto);
    expect(mockService.verifyOtp).toHaveBeenCalledWith(dto.email, dto.otp);
    expect(result).toEqual({ reset_token: 'tok' });
  });

  it('resetPassword delegates token and password', async () => {
    const dto = { reset_token: 'tok', new_password: 'newpass1' } as any;
    mockService.resetPassword.mockResolvedValue({ success: true });
    const result = await controller.resetPassword(dto);
    expect(mockService.resetPassword).toHaveBeenCalledWith(dto.reset_token, dto.new_password);
    expect(result).toEqual({ success: true });
  });

  it('getGoogleAuthUrl delegates to service', async () => {
    mockService.googleGetAuthUrl.mockResolvedValue({ url: 'https://accounts.google.com/oauth' });
    const result = await controller.getGoogleAuthUrl();
    expect(mockService.googleGetAuthUrl).toHaveBeenCalled();
    expect(result).toEqual({ url: 'https://accounts.google.com/oauth' });
  });

  it('googleCallback delegates code', async () => {
    mockService.googleCallback.mockResolvedValue({ token: 'jwt', isNew: false });
    const result = await controller.googleCallback('auth-code-123');
    expect(mockService.googleCallback).toHaveBeenCalledWith('auth-code-123');
    expect(result).toMatchObject({ token: 'jwt' });
  });

  it('logout clears cookie and returns success', () => {
    const res = { cookie: jest.fn() } as any;
    const result = controller.logout(res);
    expect(res.cookie).toHaveBeenCalledWith(
      'persona', '', expect.objectContaining({ maxAge: 0 }),
    );
    expect(result).toEqual({ success: true, message: 'Logged out successfully' });
  });
});
