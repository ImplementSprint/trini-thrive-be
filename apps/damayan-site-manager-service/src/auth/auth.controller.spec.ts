import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
  SignJWT: jest.fn(),
}));

describe('AuthController', () => {
  let controller: AuthController;
  const mockService = {
    login: jest.fn().mockResolvedValue({}),
    JwtGuard: jest.fn().mockResolvedValue({}),
    PersonaGuard: jest.fn().mockResolvedValue({}),
    getProfile: jest.fn().mockResolvedValue({}),
    updateProfile: jest.fn().mockResolvedValue({}),
    forgotPassword: jest.fn().mockResolvedValue({}),
    resetPassword: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call login', async () => {
    await controller.login({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

      it('should call getProfile', async () => {
    await controller.getProfile({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call updateProfile', async () => {
    await controller.updateProfile({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call forgotPassword', async () => {
    await controller.forgotPassword({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call resetPassword', async () => {
    await controller.resetPassword({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

});
