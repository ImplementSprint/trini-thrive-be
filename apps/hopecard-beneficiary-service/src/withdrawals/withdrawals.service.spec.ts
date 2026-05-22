import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProcedureEventService } from '@app/api-center';
import { WithdrawalsService } from './withdrawals.service';

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockSingle = jest.fn();
const mockOrder = jest.fn();

const mockChain: any = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: mockOrder,
  limit: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  single: mockSingle,
  maybeSingle: jest.fn(),
};

const mockSupabase = { from: jest.fn(() => mockChain) };
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const mockEmit = jest.fn();

describe('WithdrawalsService', () => {
  let service: WithdrawalsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.from.mockImplementation(() => mockChain);
    mockChain.select.mockReturnThis();
    mockChain.eq.mockReturnThis();
    mockChain.order.mockReturnThis();
    mockChain.insert.mockReturnThis();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: ProcedureEventService, useValue: { emit: mockEmit } },
      ],
    }).compile();
    service = module.get<WithdrawalsService>(WithdrawalsService);
  });

  // ── requestWithdrawal ────────────────────────────────────────────────────────
  describe('requestWithdrawal', () => {
    it('throws BadRequestException for zero amount', async () => {
      await expect(service.requestWithdrawal('uid-1', { amount: 0 })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException for negative amount', async () => {
      await expect(service.requestWithdrawal('uid-1', { amount: -100 })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException for non-number amount', async () => {
      await expect(service.requestWithdrawal('uid-1', { amount: 'abc' as any })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when profile or beneficiary not found', async () => {
      // Promise.all resolves both queries simultaneously
      // profile query: from('beneficiary_profiles').select('id').eq(...).single()
      // beneficiary query: from('beneficiaries').select('id').eq(...).single()
      mockSingle
        .mockResolvedValueOnce({ data: null }) // profile — null
        .mockResolvedValueOnce({ data: null }); // beneficiary — null

      await expect(service.requestWithdrawal('uid-1', { amount: 100 })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException for insufficient balance', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' } }) // profile
        .mockResolvedValueOnce({ data: { id: 'b-1' } }); // beneficiary

      // txRows: select('amount').eq(...).eq(status, approved) — chain (no terminal)
      // wdRows: select('amount').eq(...).eq(status, approved) — chain (no terminal)
      // Both are awaited chain objects → data is undefined → reduce gives 0
      // available = 0 - 0 = 0, amount = 500 > 0 → BadRequestException

      await expect(service.requestWithdrawal('uid-1', { amount: 500 })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates withdrawal and emits event when balance is sufficient', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' } }) // profile
        .mockResolvedValueOnce({ data: { id: 'b-1' } }) // beneficiary
        .mockResolvedValueOnce({ data: { id: 'wd-1', amount: 100, status: 'pending' }, error: null }); // insert withdrawal

      // txRows and wdRows are awaited chains that resolve to undefined
      // We need txRows to show available balance
      // Let's override with a thenable chain for the tx/wd queries
      // Since they use the same mockChain and chain.eq returns this,
      // await chain = chain object, { data: undefined } → reduce([], 0) = 0
      // So available = 0, amount = 100 > 0 → would throw

      // To test success, we need to provide actual balance data.
      // Override the from() to return specific results for each table:
      let fromCallCount = 0;
      mockSupabase.from.mockImplementation(() => {
        fromCallCount++;
        switch (fromCallCount) {
          case 1: // beneficiary_profiles
            return { ...mockChain, single: () => Promise.resolve({ data: { id: 'p-1' } }) };
          case 2: // beneficiaries
            return { ...mockChain, single: () => Promise.resolve({ data: { id: 'b-1' } }) };
          case 3: { // beneficiary_transactions (txRows)
            const c: any = { ...mockChain };
            Object.defineProperty(c, 'then', { get: () => (res: any) => Promise.resolve({ data: [{ amount: '1000' }] }).then(res) });
            return c;
          }
          case 4: { // beneficiary_withdrawals (wdRows)
            const c: any = { ...mockChain };
            Object.defineProperty(c, 'then', { get: () => (res: any) => Promise.resolve({ data: [{ amount: '200' }] }).then(res) });
            return c;
          }
          case 5: // insert withdrawal
            return { ...mockChain, insert: jest.fn(() => ({ ...mockChain, single: () => Promise.resolve({ data: { id: 'wd-1', amount: 100 }, error: null }) })) };
          case 6: // beneficiary_banking_activity insert
            return mockChain;
          default:
            return mockChain;
        }
      });

      const result = await service.requestWithdrawal('uid-1', { amount: 500, bank_account_id: 'acc-1' });
      expect(result.withdrawal).toBeDefined();
      expect(mockEmit).toHaveBeenCalledWith(
        'hopecard.withdrawal.requested',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('throws BadRequestException when withdrawal insert fails', async () => {
      let fromCallCount = 0;
      mockSupabase.from.mockImplementation(() => {
        fromCallCount++;
        switch (fromCallCount) {
          case 1:
            return { ...mockChain, single: () => Promise.resolve({ data: { id: 'p-1' } }) };
          case 2:
            return { ...mockChain, single: () => Promise.resolve({ data: { id: 'b-1' } }) };
          case 3: {
            const c: any = { ...mockChain };
            Object.defineProperty(c, 'then', { get: () => (res: any) => Promise.resolve({ data: [{ amount: '1000' }] }).then(res) });
            return c;
          }
          case 4: {
            const c: any = { ...mockChain };
            Object.defineProperty(c, 'then', { get: () => (res: any) => Promise.resolve({ data: [] }).then(res) });
            return c;
          }
          default:
            return { ...mockChain, insert: jest.fn(() => ({ ...mockChain, single: () => Promise.resolve({ data: null, error: { message: 'insert error' } }) })) };
        }
      });

      await expect(service.requestWithdrawal('uid-1', { amount: 500 })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── getWithdrawals ───────────────────────────────────────────────────────────
  describe('getWithdrawals', () => {
    it('returns withdrawals list', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'b-1' }, error: null });
      mockOrder.mockResolvedValueOnce({ data: [{ id: 'wd-1', amount: 100 }], error: null });

      const result = await service.getWithdrawals('uid-1');
      expect(result.withdrawals).toHaveLength(1);
    });

    it('returns empty array when no withdrawals', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'b-1' }, error: null });
      mockOrder.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.getWithdrawals('uid-1');
      expect(result.withdrawals).toEqual([]);
    });

    it('throws NotFoundException when beneficiary not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.getWithdrawals('uid-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException on DB error', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'b-1' }, error: null });
      mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });

      await expect(service.getWithdrawals('uid-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
