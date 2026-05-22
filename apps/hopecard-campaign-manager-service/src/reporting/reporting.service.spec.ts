import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportingService } from './reporting.service';

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}));

function makeChain(data: any, error: any = null) {
  const c: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
  };
  c.then = (res: any, rej: any) =>
    Promise.resolve({ data, error }).then(res, rej);
  return c;
}

const mockConfigService = {
  get: (k: string) =>
    ({
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
    })[k],
};

describe('ReportingService', () => {
  let service: ReportingService;

  beforeEach(async () => {
    mockFrom.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<ReportingService>(ReportingService);
    // Inject mock supabase directly
    (service as any).supabase = { from: mockFrom };
  });

  describe('getDashboardData — empty state', () => {
    it('returns zero metrics when manager has no campaigns', async () => {
      mockFrom.mockReturnValueOnce(
        makeChain({ first_name: 'Alice', last_name: 'Smith' }),
      );
      mockFrom.mockReturnValueOnce(makeChain([]));

      const result = await service.getDashboardData('uid-1');
      expect(result.metrics.managerName).toBe('Alice Smith');
      expect(result.metrics.fundsRaised).toBe(0);
      expect(result.metrics.activeCampaigns).toBe(0);
      expect(result.metrics.totalDonors).toBe(0);
      expect(result.campaigns).toEqual([]);
      expect(result.liveActivity).toEqual([]);
    });

    it('uses "Manager" as fallback when profile is null', async () => {
      mockFrom.mockReturnValueOnce(makeChain(null));
      mockFrom.mockReturnValueOnce(makeChain([]));
      const result = await service.getDashboardData('uid-2');
      expect(result.metrics.managerName).toBe('Manager');
    });
  });

  describe('getDashboardData — with campaigns, no hopecards', () => {
    it('aggregates funds, active and pending counts correctly', async () => {
      const campaigns = [
        {
          id: 'c1',
          title: 'Camp A',
          status: 'active',
          collected_amount: 200,
          target_amount: 1000,
          end_date: '2025-12-31',
          cover_image_key: null,
          created_at: '2024-01-01',
        },
        {
          id: 'c2',
          title: 'Camp B',
          status: 'draft',
          collected_amount: 50,
          target_amount: 500,
          end_date: null,
          cover_image_key: null,
          created_at: '2024-01-02',
        },
      ];
      mockFrom.mockReturnValueOnce(
        makeChain({ first_name: 'Bob', last_name: 'Doe' }),
      );
      mockFrom.mockReturnValueOnce(makeChain(campaigns));
      mockFrom.mockReturnValueOnce(makeChain([])); // hopecards — empty

      const result = await service.getDashboardData('uid-3');
      expect(result.metrics.fundsRaised).toBe(250);
      expect(result.metrics.activeCampaigns).toBe(1);
      expect(result.metrics.pendingActions).toBe(1);
      expect(result.campaigns).toHaveLength(2);
    });
  });

  describe('getDashboardData — full data flow', () => {
    it('populates liveActivity with donor names', async () => {
      const campaigns = [
        {
          id: 'c1',
          title: 'Camp A',
          status: 'active',
          collected_amount: 100,
          target_amount: 500,
          end_date: '2025-12-31',
          cover_image_key: null,
          created_at: '2024-01-01',
        },
      ];
      const hopecards = [{ id: 'h1', campaign_id: 'c1' }];
      const purchases = [
        {
          id: 'p1',
          buyer_auth_id: 'buyer1',
          amount_paid: 50,
          purchased_at: '2024-06-01',
          hopecard_id: 'h1',
          status: 'paid',
        },
      ];
      const donors = [
        { auth_user_id: 'buyer1', first_name: 'Jane', last_name: 'Doe' },
      ];

      mockFrom.mockReturnValueOnce(
        makeChain({ first_name: 'Mgr', last_name: 'X' }),
      );
      mockFrom.mockReturnValueOnce(makeChain(campaigns));
      mockFrom.mockReturnValueOnce(makeChain(hopecards));
      mockFrom.mockReturnValueOnce(makeChain(purchases));
      mockFrom.mockReturnValueOnce(makeChain(donors));

      const result = await service.getDashboardData('uid-4');
      expect(result.metrics.totalDonors).toBe(1);
      expect(result.liveActivity).toHaveLength(1);
      expect(result.liveActivity[0].donorName).toBe('Jane Doe');
      expect(result.liveActivity[0].amount).toBe(50);
      expect(result.liveActivity[0].campaignTitle).toBe('Camp A');
    });

    it('uses "Anonymous" when donor is not in donor map', async () => {
      const campaigns = [
        {
          id: 'c1',
          title: 'X',
          status: 'active',
          collected_amount: 0,
          target_amount: 0,
          end_date: null,
          cover_image_key: null,
          created_at: '2024-01-01',
        },
      ];
      mockFrom.mockReturnValueOnce(
        makeChain({ first_name: 'M', last_name: 'Y' }),
      );
      mockFrom.mockReturnValueOnce(makeChain(campaigns));
      mockFrom.mockReturnValueOnce(
        makeChain([{ id: 'h1', campaign_id: 'c1' }]),
      );
      mockFrom.mockReturnValueOnce(
        makeChain([
          {
            id: 'p1',
            buyer_auth_id: 'unknown',
            amount_paid: 10,
            purchased_at: '2024-01-01',
            hopecard_id: 'h1',
            status: 'paid',
          },
        ]),
      );
      mockFrom.mockReturnValueOnce(makeChain([])); // donors — none found

      const result = await service.getDashboardData('uid-5');
      expect(result.liveActivity[0].donorName).toBe('Anonymous');
    });
  });

  describe('getDashboardData — error handling', () => {
    it('throws InternalServerErrorException when supabase throws', async () => {
      mockFrom.mockImplementationOnce(() => {
        throw new Error('connection lost');
      });
      await expect(service.getDashboardData('uid-6')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('onModuleInit — missing env vars', () => {
    it('logs error and skips client creation when env vars absent', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mod = await Test.createTestingModule({
        providers: [
          ReportingService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
        ],
      }).compile();
      expect(mod.get<ReportingService>(ReportingService)).toBeDefined();
      spy.mockRestore();
    });
  });
});
