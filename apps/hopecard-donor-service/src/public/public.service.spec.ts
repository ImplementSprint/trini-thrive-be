import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PublicService } from './public.service';

const mockSupabaseRequest = jest.fn();
jest.mock('@app/common/supabase-helpers', () => ({
  supabaseRequest: (...args: any[]) => mockSupabaseRequest(...args),
}));
jest.mock('@app/common/storage', () => ({
  getStorageUrl: jest.fn((_bucket: string, key: string | null) =>
    key ? `https://storage/${key}` : null,
  ),
}));

const campaignRow = {
  id: 'c1',
  title: 'Help',
  description: 'desc',
  category: 'health',
  target_amount: 1000,
  collected_amount: 500,
  cover_image_key: 'img.jpg',
  status: 'active',
  end_date: '2025-12-31',
};

describe('PublicService', () => {
  let service: PublicService;

  beforeEach(async () => {
    mockSupabaseRequest.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicService],
    }).compile();
    service = module.get<PublicService>(PublicService);
  });

  describe('getCampaigns', () => {
    it('returns mapped campaigns', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([campaignRow]);
      const result = await service.getCampaigns();
      expect(result.campaigns).toHaveLength(1);
      expect(result.campaigns[0]).toMatchObject({ id: 'c1', progress_pct: 50 });
    });

    it('applies category filter', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([]);
      await service.getCampaigns('health');
      expect(mockSupabaseRequest).toHaveBeenCalledWith(
        expect.stringContaining('category=eq.health'),
      );
    });

    it('applies search filter', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([]);
      await service.getCampaigns(undefined, 'flood');
      expect(mockSupabaseRequest).toHaveBeenCalledWith(
        expect.stringContaining('title=ilike'),
      );
    });

    it('returns 0 progress when target_amount is 0', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([
        { ...campaignRow, target_amount: 0, collected_amount: 0 },
      ]);
      const result = await service.getCampaigns();
      expect(result.campaigns[0].progress_pct).toBe(0);
    });

    it('caps progress at 100 when over-funded', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([
        { ...campaignRow, target_amount: 100, collected_amount: 200 },
      ]);
      const result = await service.getCampaigns();
      expect(result.campaigns[0].progress_pct).toBe(100);
    });

    it('handles null description and category', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([
        { ...campaignRow, description: null, category: null, cover_image_key: null },
      ]);
      const result = await service.getCampaigns();
      expect(result.campaigns[0].description).toBe('');
      expect(result.campaigns[0].category).toBe('other');
    });
  });

  describe('getCampaign', () => {
    it('returns single mapped campaign', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([campaignRow]);
      const result = await service.getCampaign('c1');
      expect(result.campaign).toMatchObject({ id: 'c1' });
    });

    it('throws NotFoundException when campaign not found', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([]);
      await expect(service.getCampaign('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
