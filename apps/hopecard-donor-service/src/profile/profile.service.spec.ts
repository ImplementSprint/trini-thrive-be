import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ProcedureEventService } from '@app/api-center';
import { ProfileService } from './profile.service';

const mockSupabaseRequest = jest.fn();
jest.mock('@app/common/supabase-helpers', () => ({
  supabaseRequest: (...args: any[]) => mockSupabaseRequest(...args),
  getRecordId: jest.fn((r: any) => r?.id ?? null),
  getRecordTitle: jest.fn((r: any) => r?.title ?? r?.name ?? null),
}));
jest.mock('@app/common/storage', () => ({
  getStorageUrl: jest.fn((_bucket: string, key: string | null) =>
    key ? `https://storage/${key}` : null,
  ),
}));
jest.mock('@app/common/types', () => ({}), { virtual: true });

const mockEmit = jest.fn();
const VALID_UUID = '11111111-1111-1111-1111-111111111111';

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(async () => {
    mockSupabaseRequest.mockReset();
    mockEmit.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: ProcedureEventService, useValue: { emit: mockEmit } },
      ],
    }).compile();
    service = module.get<ProfileService>(ProfileService);
  });

  describe('getProfile', () => {
    const profileRow = {
      id: 'p1', first_name: 'Ana', last_name: 'Cruz',
      phone: '09171234567', address: '123 St', barangay: 'BG',
      municipality: 'Mun', province: 'Prov',
      profile_photo_key: 'photo.jpg', status: 'active',
      created_at: '2025-01-01', total_donations_amount: 100, total_donations_count: 2,
    };

    it('returns profile for valid authUserId', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([profileRow]);
      const result = await service.getProfile(VALID_UUID);
      expect(result.profile.first_name).toBe('Ana');
      expect(result.profile.profile_photo_url).toContain('photo.jpg');
    });

    it('falls back to email query when authUserId returns empty', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([]); // auth_user_id query
      mockSupabaseRequest.mockResolvedValueOnce([profileRow]); // email query
      const result = await service.getProfile(VALID_UUID, 'ana@test.com');
      expect(result.profile.first_name).toBe('Ana');
    });

    it('throws 404 when not found by either query', async () => {
      mockSupabaseRequest.mockResolvedValue([]);
      await expect(service.getProfile(VALID_UUID, 'missing@test.com')).rejects.toMatchObject({ status: 404 });
    });

    it('throws 400 for invalid UUID', async () => {
      await expect(service.getProfile('bad-id')).rejects.toMatchObject({ status: 400 });
    });

    it('handles null optional fields with defaults', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([
        { ...profileRow, phone: null, address: null, barangay: null, municipality: null, province: null, profile_photo_key: null },
      ]);
      const result = await service.getProfile(VALID_UUID);
      expect(result.profile.phone).toBe('');
      expect(result.profile.address).toBe('');
    });
  });

  describe('updateProfile', () => {
    it('patches allowed fields and emits event', async () => {
      mockSupabaseRequest.mockResolvedValueOnce({});
      const result = await service.updateProfile(VALID_UUID, { first_name: 'New' });
      expect(result).toEqual({ success: true });
      expect(mockSupabaseRequest).toHaveBeenCalledWith(
        expect.stringContaining(VALID_UUID),
        expect.objectContaining({ method: 'PATCH' }),
      );
      expect(mockEmit).toHaveBeenCalledWith('hopecard.donor.profile_updated', expect.any(Object), expect.any(Object));
    });

    it('throws 400 for invalid UUID', async () => {
      await expect(service.updateProfile('not-a-uuid', {})).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('getImpact', () => {
    it('returns impact stats from DB', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([{ total_donations_amount: 500, total_donations_count: 3, first_name: 'Ana' }])
        .mockResolvedValueOnce([{ id: 'p1', hopecard_id: 'c1', amount_paid: 500, payment_method: 'card', status: 'paid', purchased_at: '2025-01-01' }])
        .mockResolvedValueOnce([{ id: 'c1', title: 'Camp 1' }])
        .mockResolvedValueOnce([]);
      const result = await service.getImpact(VALID_UUID);
      expect(result.stats.total_donations_amount).toBe(500);
      expect(result.first_name).toBe('Ana');
      expect(result.donation_history).toHaveLength(1);
    });

    it('handles empty profile with defaults', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const result = await service.getImpact(VALID_UUID);
      expect(result.stats.total_donations_amount).toBe(0);
      expect(result.first_name).toBe('Donor');
    });

    it('throws 400 for invalid UUID', async () => {
      await expect(service.getImpact('not-uuid')).rejects.toMatchObject({ status: 400 });
    });
  });
});
