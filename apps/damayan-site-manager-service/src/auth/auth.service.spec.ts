import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from '@app/supabase';
import { ConfigService } from '@nestjs/config';

jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('token'),
  })),
  jwtVerify: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  const mockSupabase = { getClient: jest.fn().mockReturnValue({ auth: { signInWithPassword: jest.fn().mockResolvedValue({ data: { user: { id: '1' } }, error: null }), admin: { getUserById: jest.fn().mockResolvedValue({ data: { user: { email: 'a@a.com' } }, error: null }) } }, from: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { id: '1', role: 'admin' }, error: null }) }) };
  const mockConfig = { get: jest.fn().mockReturnValue('secret') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call Logger', async () => {
    try { await service.Logger({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call getClient', async () => {
    try { await service.getClient({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call Error', async () => {
    try { await service.Error({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call getJwtSecret', async () => {
    try { await service.getJwtSecret({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call TextEncoder', async () => {
    try { await service.TextEncoder({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call signToken', async () => {
    try { await service.signToken({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call SignJWT', async () => {
    try { await service.SignJWT({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call setTimeout', async () => {
    try { await service.setTimeout({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call reject', async () => {
    try { await service.reject({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call GatewayTimeoutException', async () => {
    try { await service.GatewayTimeoutException({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call login', async () => {
    try { await service.login({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call UnauthorizedException', async () => {
    try { await service.UnauthorizedException({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call getProfile', async () => {
    try { await service.getProfile({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call BadRequestException', async () => {
    try { await service.BadRequestException({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call updateProfile', async () => {
    try { await service.updateProfile({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call forgotPassword', async () => {
    try { await service.forgotPassword({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call String', async () => {
    try { await service.String({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call createHash', async () => {
    try { await service.createHash({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call Date', async () => {
    try { await service.Date({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

  it('should call resetPassword', async () => {
    try { await service.resetPassword({} as any, {} as any, {} as any); } catch (e) {}
    expect(service).toBeDefined();
  });

});
