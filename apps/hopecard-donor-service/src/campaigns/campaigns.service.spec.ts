import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsService } from './campaigns.service';

const mockSupabaseRequest = jest.fn();
jest.mock('@app/common/supabase-helpers', () => ({
  supabaseRequest: (...args: any[]) => mockSupabaseRequest(...args),
}));
jest.mock('@app/common/storage', () => ({
  getStorageUrl: jest.fn((_bucket: string, key: string | null) =>
    key ? `https://storage/${key}` : null,
  ),
}));
jest.mock('@app/common/types', () => ({}), { virtual: true });

describe('CampaignsService', () => {
  let service: CampaignsService;

  beforeEach(async () => {
    mockSupabaseRequest.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CampaignsService],
    }).compile();
    service = module.get<CampaignsService>(CampaignsService);
  });

  it('returns mapped campaigns', async () => {
    mockSupabaseRequest.mockResolvedValueOnce([
      {
        id: 'c1',
        title: 'Help',
        description: 'desc',
        category: 'health',
        target_amount: 1000,
        collected_amount: 500,
        cover_image_key: 'key.jpg',
        status: 'active',
        end_date: '2025-12-31',
      },
    ]);
    const result = await service.getCampaigns();
    expect(result.campaigns).toHaveLength(1);
    expect(result.campaigns[0]).toMatchObject({
      id: 'c1',
      title: 'Help',
      progress_pct: 50,
      cover_image_url: 'https://storage/key.jpg',
    });
  });

  it('filters by category', async () => {
    mockSupabaseRequest.mockResolvedValueOnce([]);
    const result = await service.getCampaigns('health');
    expect(result.campaigns).toHaveLength(0);
    expect(mockSupabaseRequest).toHaveBeenCalledWith(
      expect.stringContaining('category=eq.health'),
    );
  });

  it('filters by search term', async () => {
    mockSupabaseRequest.mockResolvedValueOnce([]);
    await service.getCampaigns(undefined, 'flood');
    expect(mockSupabaseRequest).toHaveBeenCalledWith(
      expect.stringContaining('title=ilike'),
    );
  });

  it('returns 0 progress when target_amount is 0', async () => {
    mockSupabaseRequest.mockResolvedValueOnce([
      {
        id: 'c2',
        title: 'X',
        description: '',
        category: 'other',
        target_amount: 0,
        collected_amount: 0,
        cover_image_key: null,
        status: 'active',
        end_date: null,
      },
    ]);
    const result = await service.getCampaigns();
    expect(result.campaigns[0].progress_pct).toBe(0);
  });

  it('caps progress at 100 when over-funded', async () => {
    mockSupabaseRequest.mockResolvedValueOnce([
      {
        id: 'c3',
        title: 'X',
        description: '',
        category: 'other',
        target_amount: 100,
        collected_amount: 200,
        cover_image_key: null,
        status: 'active',
        end_date: null,
      },
    ]);
    const result = await service.getCampaigns();
    expect(result.campaigns[0].progress_pct).toBe(100);
  });

  it('applies both category and search filters together', async () => {
    mockSupabaseRequest.mockResolvedValueOnce([]);
    await service.getCampaigns('health', 'flood');
    expect(mockSupabaseRequest).toHaveBeenCalledWith(
      expect.stringMatching(/category=eq\.health.*title=ilike/),
    );
  });
});
