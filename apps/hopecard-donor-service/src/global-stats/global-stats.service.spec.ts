import { Test, TestingModule } from '@nestjs/testing';
import { GlobalStatsService } from './global-stats.service';

const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}));

describe('GlobalStatsService', () => {
  let service: GlobalStatsService;

  beforeEach(async () => {
    mockFrom.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalStatsService],
    }).compile();
    service = module.get<GlobalStatsService>(GlobalStatsService);
  });

  it('computes stats from purchases and beneficiary count', async () => {
    const purchasesChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [{ amount_paid: 1000 }, { amount_paid: 400 }], error: null }),
    };
    const beneficiariesChain = {
      select: jest.fn().mockResolvedValue({ data: null, error: null, count: 5 }),
    };
    mockFrom.mockReturnValueOnce(purchasesChain).mockReturnValueOnce(beneficiariesChain);

    const result = await service.getStats();
    expect(result.fundsRaised).toBe(1400);
    expect(result.livesImpacted).toBe(7); // Math.floor(1400 / 200)
    expect(result.globalPartners).toBe(5);
  });

  it('returns zeros when data is null', async () => {
    const purchasesChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    const beneficiariesChain = {
      select: jest.fn().mockResolvedValue({ data: null, error: null, count: null }),
    };
    mockFrom.mockReturnValueOnce(purchasesChain).mockReturnValueOnce(beneficiariesChain);

    const result = await service.getStats();
    expect(result.fundsRaised).toBe(0);
    expect(result.livesImpacted).toBe(0);
    expect(result.globalPartners).toBe(0);
  });

  it('handles rows with non-numeric amount_paid gracefully', async () => {
    const purchasesChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [{ amount_paid: null }, { amount_paid: 'bad' }], error: null }),
    };
    const beneficiariesChain = {
      select: jest.fn().mockResolvedValue({ data: null, error: null, count: 0 }),
    };
    mockFrom.mockReturnValueOnce(purchasesChain).mockReturnValueOnce(beneficiariesChain);

    const result = await service.getStats();
    expect(result.fundsRaised).toBe(0);
  });
});
