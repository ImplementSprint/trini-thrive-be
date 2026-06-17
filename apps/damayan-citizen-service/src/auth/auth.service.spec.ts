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
}));

describe('AuthService', () => {
  let service: AuthService;
  const mockSupabase = { getClient: jest.fn() };
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
});
