import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SupabaseService } from '@app/supabase';

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  storage: {
    from: jest.fn().mockReturnThis(),
    upload: jest.fn(),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/doc.jpg' } }),
    remove: jest.fn(),
  },
  auth: {
    admin: {
      createUser: jest.fn(),
      listUsers: jest.fn(),
      updateUserById: jest.fn(),
      deleteUser: jest.fn(),
    },
  },
};

const mockSupabaseService = {
  getClient: jest.fn().mockReturnValue(mockSupabaseClient),
};

const mockConfigService = {
  get: jest.fn(),
  getOrThrow: jest.fn(),
};

describe('AuthService (bayanihub-enduser)', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('forgotPassword', () => {
    it('should return generic message regardless of email existence', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
      const result = await service.forgotPassword({ email: 'test@example.com' });
      expect(result).toHaveProperty('message');
    });
  });

  describe('verifyOtp', () => {
    it('should throw if no OTP exists for email', async () => {
      await expect(service.verifyOtp({ email: 'none@example.com', code: '123456' })).rejects.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should throw if no OTP exists', async () => {
      await expect(
        service.resetPassword({ email: 'none@example.com', otp: '123456', newPassword: 'newpass' }),
      ).rejects.toThrow();
    });
  });
});
