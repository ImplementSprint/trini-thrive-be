import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from '@app/supabase';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException, GatewayTimeoutException } from '@nestjs/common';

jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-jwt-token'),
  })),
}));

describe('AuthService', () => {
  let service: AuthService;
  let supabaseService: SupabaseService;
  let configService: ConfigService;

  const mockSupabaseClient = {
    auth: {
      signInWithPassword: jest.fn(),
      admin: {
        getUserById: jest.fn(),
        updateUserById: jest.fn(),
        listUsers: jest.fn(),
      },
    },
    from: jest.fn(),
  };

  const mockSupabaseService = {
    getClient: jest.fn().mockReturnValue(mockSupabaseClient),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret-key-that-is-long-enough'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const mockSelect = jest.fn();
    const mockEq = jest.fn();
    const mockMaybeSingle = jest.fn();

    beforeEach(() => {
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    });

    it('should login an admin successfully', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null,
      });

      mockMaybeSingle.mockResolvedValue({
        data: { id: 'profile-id', role: 'admin', first_name: 'Admin', last_name: 'User' },
        error: null,
      });

      const result = await service.login({ email: 'test@test.com', password: 'password' });
      expect(result.message).toEqual('Login successful');
      expect(result.access_token).toBeDefined();
      expect(result.user.role).toEqual('admin');
    });

    it('should throw UnauthorizedException if not an admin', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null,
      });

      mockMaybeSingle.mockResolvedValue({
        data: { id: 'profile-id', role: 'citizen', first_name: 'Citizen', last_name: 'User' },
        error: null,
      });

      await expect(service.login({ email: 'test@test.com', password: 'password' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials' },
      });

      await expect(service.login({ email: 'test@test.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    const mockSelect = jest.fn();
    const mockEq = jest.fn();
    const mockMaybeSingle = jest.fn();

    beforeEach(() => {
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    });

    it('should return profile successfully', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: 'profile-id', first_name: 'Admin', last_name: 'User', role: 'admin' },
        error: null,
      });

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { email: 'admin@test.com' } },
        error: null,
      });

      const result = await service.getProfile('user-id');
      expect(result.user.id).toEqual('profile-id');
      expect(result.user.firstName).toEqual('Admin');
      expect(result.user.email).toEqual('admin@test.com');
    });

    it('should throw BadRequestException if profile lookup fails', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Profile error' },
      });

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(service.getProfile('user-id')).rejects.toThrow(BadRequestException);
    });
  });
});
