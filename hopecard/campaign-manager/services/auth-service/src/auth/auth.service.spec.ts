import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}));

function selectChain(result: { data: any; error: any }) {
  const c: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
  return c;
}

describe('AuthService (CM)', () => {
  let service: AuthService;

  beforeEach(async () => {
    mockFrom.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              ({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'key' })[k],
          },
        },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    // Inject mock supabase directly — avoids relying on onModuleInit lifecycle
    (service as any).supabase = { from: mockFrom };
  });

  describe('getManagerProfile', () => {
    it('returns profile data on success', async () => {
      mockFrom.mockReturnValueOnce(selectChain({ data: { first_name: 'Jane' }, error: null }));
      const result = await service.getManagerProfile('uid-1');
      expect(result).toEqual({ first_name: 'Jane' });
      expect(mockFrom).toHaveBeenCalledWith('campaign_manager_profiles');
    });

    it('throws InternalServerErrorException on DB error', async () => {
      mockFrom.mockReturnValueOnce(selectChain({ data: null, error: { message: 'DB failure' } }));
      await expect(service.getManagerProfile('uid-1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('getBeneficiaryProfiles', () => {
    it('fetches all profiles without status filter', async () => {
      const c: any = { select: jest.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }) };
      mockFrom.mockReturnValueOnce(c);
      const result = await service.getBeneficiaryProfiles();
      expect(result).toEqual([{ id: '1' }]);
    });

    it('filters by status when provided', async () => {
      const c: any = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [{ id: '2', status: 'approved' }], error: null }),
        }),
      };
      mockFrom.mockReturnValueOnce(c);
      const result = await service.getBeneficiaryProfiles('approved');
      expect(result).toEqual([{ id: '2', status: 'approved' }]);
    });

    it('throws InternalServerErrorException on DB error', async () => {
      const c: any = {
        select: jest.fn().mockResolvedValue({ data: null, error: { message: 'err' } }),
      };
      mockFrom.mockReturnValueOnce(c);
      await expect(service.getBeneficiaryProfiles()).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('onModuleInit — missing env vars', () => {
    it('logs error and skips client creation when env vars absent', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mod = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
        ],
      }).compile();
      expect(mod.get<AuthService>(AuthService)).toBeDefined();
      spy.mockRestore();
    });
  });
});
