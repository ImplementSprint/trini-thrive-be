import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

jest.mock('jose', () => ({
  SignJWT: jest.fn(),
  jwtVerify: jest.fn(),
}));

describe('AuthController', () => {
  let controller: AuthController;
  const mockAuthService = {
    signup: jest.fn().mockResolvedValue({ id: '1' }),
    login: jest.fn().mockResolvedValue({ access_token: 'token' }),
    getProfile: jest.fn().mockResolvedValue({ id: '1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should signup', async () => {
    const res = await controller.signup({ email: 'test', password: 'test', firstName: 'test', lastName: 'test' });
    expect(res.id).toBe('1');
  });

  it('should login', async () => {
    const res = await controller.login({ email: 'test', password: 'test' });
    expect(res.access_token).toBe('token');
  });

  it('should get profile', async () => {
    const res = await controller.getProfile({ user: { sub: '1' } });
    expect(res.id).toBe('1');
  });
});
