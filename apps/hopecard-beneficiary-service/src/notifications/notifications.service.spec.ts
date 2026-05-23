import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { BeneficiaryNotificationsService } from './notifications.service';

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockMaybeSingle = jest.fn();
const mockOrder = jest.fn();

interface MockChain {
  select: jest.Mock;
  eq: jest.Mock;
  in: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  update: jest.Mock;
  insert: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
}

const mockChain: MockChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: mockOrder,
  limit: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  single: jest.fn(),
  maybeSingle: mockMaybeSingle,
};

const mockSupabase = { from: jest.fn(() => mockChain) };
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('BeneficiaryNotificationsService', () => {
  let service: BeneficiaryNotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockChain.select.mockReturnThis();
    mockChain.eq.mockReturnThis();
    mockChain.order.mockReturnThis();
    mockChain.limit.mockReturnThis();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [BeneficiaryNotificationsService],
    }).compile();
    service = module.get<BeneficiaryNotificationsService>(
      BeneficiaryNotificationsService,
    );
  });

  // ── getNotifications ─────────────────────────────────────────────────────────
  describe('getNotifications', () => {
    it('returns empty notifications when neither profile nor beneficiary found', async () => {
      // getProfileAndBeneficiary: two maybeSingle calls via Promise.all
      mockMaybeSingle
        .mockResolvedValueOnce({ data: null }) // profile
        .mockResolvedValueOnce({ data: null }); // beneficiary

      const result = await service.getNotifications('uid-1');
      expect(result.notifications).toEqual([]);
      expect(result.unread_count).toBe(0);
    });

    it('returns invitation notifications when profile found', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' } }) // profile
        .mockResolvedValueOnce({ data: null }); // beneficiary

      // invitations query: .select().eq().eq().order().limit()
      // limit() returns this (chain), await chain = chain, data is undefined
      // We need the invitations query to return data
      // Override using thenable on limit
      mockChain.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'inv-1',
            invited_at: '2024-06-01T10:00:00Z',
            hc_campaigns: { title: 'Help Camp' },
          },
        ],
        error: null,
      });

      const result = await service.getNotifications('uid-1');
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].type).toBe('invitation');
      expect(result.notifications[0].message).toContain('Help Camp');
      expect(result.unread_count).toBe(1);
    });

    it('returns disbursement notifications when beneficiary found', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: null }) // profile
        .mockResolvedValueOnce({ data: { id: 'b-1' } }); // beneficiary

      mockChain.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'tx-1',
            amount: '1000',
            created_at: '2024-05-15T08:00:00Z',
            notes: 'Monthly support',
          },
        ],
        error: null,
      });

      const result = await service.getNotifications('uid-1');
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].type).toBe('disbursement');
      expect(result.notifications[0].message).toContain('1,000');
      expect(result.notifications[0].message).toContain('Monthly support');
    });

    it('merges and sorts notifications when both profile and beneficiary found', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' } }) // profile
        .mockResolvedValueOnce({ data: { id: 'b-1' } }); // beneficiary

      mockChain.limit
        .mockResolvedValueOnce({
          // invitations
          data: [
            {
              id: 'inv-1',
              invited_at: '2024-06-01T10:00:00Z',
              hc_campaigns: { title: 'Camp A' },
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          // transactions
          data: [
            {
              id: 'tx-1',
              amount: '500',
              created_at: '2024-06-02T08:00:00Z',
              notes: null,
            },
          ],
          error: null,
        });

      const result = await service.getNotifications('uid-1');
      expect(result.notifications).toHaveLength(2);
      expect(result.unread_count).toBe(2);
      // Sorted descending by date: tx (Jun 2) first, inv (Jun 1) second
      expect(result.notifications[0].type).toBe('disbursement');
      expect(result.notifications[1].type).toBe('invitation');
    });

    it('handles campaign with no title (uses default)', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' } })
        .mockResolvedValueOnce({ data: null });

      mockChain.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'inv-2',
            invited_at: '2024-06-01T10:00:00Z',
            hc_campaigns: null,
          },
        ],
        error: null,
      });

      const result = await service.getNotifications('uid-1');
      expect(result.notifications[0].message).toContain('a campaign');
    });

    it('handles disbursement with no notes', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValueOnce({ data: { id: 'b-1' } });

      mockChain.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'tx-2',
            amount: '200',
            created_at: '2024-06-01T10:00:00Z',
            notes: null,
          },
        ],
        error: null,
      });

      const result = await service.getNotifications('uid-1');
      expect(result.notifications[0].message).toContain('.');
      expect(result.notifications[0].message).not.toContain('undefined');
    });
  });
});
