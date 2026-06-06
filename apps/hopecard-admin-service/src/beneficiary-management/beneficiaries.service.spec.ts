import { BeneficiariesService } from './beneficiaries.service';

jest.mock('@app/common/supabase-client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('@app/common/activity-logger', () => ({
  ActivityLogger: jest.fn().mockImplementation(() => ({
    logActivity: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@app/api-center', () => ({
  ProcedureEventService: jest.fn().mockImplementation(() => ({
    emit: jest.fn(),
  })),
}));

const getSupabase = () =>
  (require('@app/common/supabase-client') as { supabase: any }).supabase;

const makeSbChain = (result: any) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue(result),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockResolvedValue(result),
  in: jest.fn().mockResolvedValue(result),
  delete: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
});

describe('BeneficiariesService', () => {
  let service: BeneficiariesService;
  let mockActivityLogger: any;
  let mockEvents: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockActivityLogger = { logActivity: jest.fn().mockResolvedValue(undefined) };
    mockEvents = { emit: jest.fn() };
    service = new BeneficiariesService(mockActivityLogger, mockEvents);
  });

  // ── getAllBeneficiaries ───────────────────────────────────────────────────────
  describe('getAllBeneficiaries', () => {
    it('returns formatted campaign list with resolved manager and beneficiary names', async () => {
      const s = getSupabase();
      const campaign = { id: 'c1', title: 'Hope Run', created_by: 'mgr-uid', status: 'active', collected_amount: 500, created_at: '2024-01-01' };
      const manager = { id: 'mp1', auth_user_id: 'mgr-uid', first_name: 'Mark', last_name: 'Lee', organization_name: 'MarkOrg' };
      const junctionRow = { campaign_id: 'c1', beneficiary_profile_id: 'bp1' };
      const directLink = { id: 'bp2', first_name: 'Dir', last_name: 'Link', campaign_id: 'c1' };
      const profile = { id: 'bp1', first_name: 'Ben', last_name: 'Fit' };

      let callCount = 0;
      s.from.mockImplementation((table: string) => {
        callCount++;
        if (callCount === 1) return { select: jest.fn().mockResolvedValue({ count: 1 }) };
        if (table === 'hc_campaigns' && callCount === 2) {
          return makeSbChain({ data: [campaign], error: null });
        }
        if (table === 'campaign_manager_profiles') {
          return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [manager] }) };
        }
        if (table === 'campaign_beneficiaries') {
          return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [junctionRow] }) };
        }
        if (table === 'beneficiary_profiles' && callCount === 5) {
          return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [directLink] }) };
        }
        if (table === 'beneficiary_profiles') {
          return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [profile] }) };
        }
        return makeSbChain({ data: [], error: null });
      });

      const result = await service.getAllBeneficiaries(1, 10);
      expect(result.data.length).toBe(1);
      expect(result.data[0].campaign).toBe('Hope Run');
    });

    it('returns empty data on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('DB crash'); });
      const result = await service.getAllBeneficiaries();
      expect(result.data).toEqual([]);
    });

    it('throws when paginated query returns error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: jest.fn().mockResolvedValue({ count: 0 }) };
        // paginated query
        return makeSbChain({ data: null, error: { message: 'Fetch failed' } });
      });
      const result = await service.getAllBeneficiaries();
      expect(result.data).toEqual([]);
    });

    it('maps campaign status correctly', async () => {
      const s = getSupabase();
      const statuses = [
        { status: 'completed', expected: 'Sent' },
        { status: 'pending', expected: 'Pending' },
        { status: 'cancelled', expected: 'Rejected' },
      ];

      for (const { status, expected } of statuses) {
        jest.clearAllMocks();
        let callCount = 0;
        s.from.mockImplementation((table: string) => {
          callCount++;
          if (callCount === 1) return { select: jest.fn().mockResolvedValue({ count: 1 }) };
          if (table === 'hc_campaigns') return makeSbChain({ data: [{ id: 'c1', title: 'T', created_by: null, status, collected_amount: 0, created_at: '2024-01-01' }], error: null });
          return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [] }) };
        });
        const result = await service.getAllBeneficiaries();
        expect(result.data[0].status).toBe(expected);
      }
    });
  });

  // ── getBeneficiaryById ───────────────────────────────────────────────────────
  describe('getBeneficiaryById', () => {
    it('returns beneficiary data on success', async () => {
      const s = getSupabase();
      const benef = { id: 'b1', first_name: 'John', last_name: 'Doe', email: 'j@t.com', status: 'approved' };
      s.from.mockImplementation(() => makeSbChain({ data: benef, error: null }));

      const result = await service.getBeneficiaryById('b1');
      expect(result.first_name).toBe('John');
    });

    it('throws when supabase returns error', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => makeSbChain({ data: null, error: { message: 'Not found' } }));
      await expect(service.getBeneficiaryById('b1')).rejects.toThrow('Failed to fetch beneficiary');
    });

    it('throws when data is null', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => makeSbChain({ data: null, error: null }));
      await expect(service.getBeneficiaryById('b1')).rejects.toThrow('Beneficiary not found');
    });
  });

  // ── getBeneficiariesByStatus ─────────────────────────────────────────────────
  describe('getBeneficiariesByStatus', () => {
    it('returns paginated data for given status', async () => {
      const s = getSupabase();
      const row = { id: 'b1', status: 'approved', created_at: '2024-01-01' };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // count query
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ count: 1 }),
          };
        }
        return makeSbChain({ data: [row], error: null });
      });

      const result = await service.getBeneficiariesByStatus('approved', 1, 10);
      expect(result.data.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('throws on supabase error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ count: 0 }) };
        return makeSbChain({ data: null, error: { message: 'DB error' } });
      });
      await expect(service.getBeneficiariesByStatus('approved')).rejects.toThrow('Failed to fetch beneficiaries');
    });
  });

  // ── searchBeneficiaries ──────────────────────────────────────────────────────
  describe('searchBeneficiaries', () => {
    it('returns matching beneficiaries on success', async () => {
      const s = getSupabase();
      const row = { id: 'b1', first_name: 'John', last_name: 'Doe' };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            or: jest.fn().mockResolvedValue({ count: 1 }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockResolvedValue({ data: [row], error: null }),
        };
      });

      const result = await service.searchBeneficiaries('John', 1, 10);
      expect(result.data[0].first_name).toBe('John');
    });

    it('throws on supabase error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: jest.fn().mockReturnThis(), or: jest.fn().mockResolvedValue({ count: 0 }) };
        return {
          select: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockResolvedValue({ data: null, error: { message: 'Search error' } }),
        };
      });
      await expect(service.searchBeneficiaries('John')).rejects.toThrow('Failed to search beneficiaries');
    });
  });

  // ── createBeneficiary ────────────────────────────────────────────────────────
  describe('createBeneficiary', () => {
    it('creates and emits event on success with pending status', async () => {
      const s = getSupabase();
      const newBenef = { id: 'b-new', first_name: 'New', last_name: 'Ben', email: 'new@t.com', status: 'pending', verification_status: 'pending' };
      s.from.mockImplementation(() => ({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: newBenef, error: null }),
      }));

      const result = await service.createBeneficiary({ first_name: 'New', last_name: 'Ben' });
      expect(result.id).toBe('b-new');
      expect(mockEvents.emit).toHaveBeenCalledWith('hopecard.beneficiary.created_by_admin', expect.any(Object), expect.any(Object));
      expect(mockActivityLogger.logActivity).toHaveBeenCalled();
    });

    it('does not log activity when status is not pending', async () => {
      const s = getSupabase();
      const newBenef = { id: 'b-new', first_name: 'New', last_name: 'Ben', email: 'new@t.com', status: 'approved', verification_status: 'approved' };
      s.from.mockImplementation(() => ({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: newBenef, error: null }),
      }));

      const result = await service.createBeneficiary({ first_name: 'New' });
      expect(result.id).toBe('b-new');
      expect(mockActivityLogger.logActivity).not.toHaveBeenCalled();
    });

    it('throws on supabase error', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => ({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      }));
      await expect(service.createBeneficiary({})).rejects.toThrow('Failed to create beneficiary');
    });
  });

  // ── updateBeneficiary ────────────────────────────────────────────────────────
  describe('updateBeneficiary', () => {
    it('updates and emits event on success', async () => {
      const s = getSupabase();
      const updated = { id: 'b1', first_name: 'Updated', last_name: 'Ben' };
      s.from.mockImplementation(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updated, error: null }),
      }));

      const result = await service.updateBeneficiary('b1', { first_name: 'Updated' });
      expect(result.first_name).toBe('Updated');
      expect(mockEvents.emit).toHaveBeenCalledWith('hopecard.beneficiary.updated', expect.any(Object), expect.any(Object));
    });

    it('throws on supabase error', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
      }));
      await expect(service.updateBeneficiary('b1', {})).rejects.toThrow('Failed to update beneficiary');
    });

    it('throws when data is null (not found)', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }));
      await expect(service.updateBeneficiary('b1', {})).rejects.toThrow('Beneficiary not found');
    });
  });

  // ── deleteBeneficiary ────────────────────────────────────────────────────────
  describe('deleteBeneficiary', () => {
    it('deletes and emits event on success', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => ({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [{ id: 'b1' }], error: null }),
      }));

      const result = await service.deleteBeneficiary('b1');
      expect(result.success).toBe(true);
      expect(mockEvents.emit).toHaveBeenCalledWith('hopecard.beneficiary.deleted', expect.any(Object), expect.any(Object));
    });

    it('throws when delete returns 0 rows (RLS block)', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => ({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      }));
      await expect(service.deleteBeneficiary('b1')).rejects.toThrow('not found or delete was blocked');
    });

    it('throws on supabase error', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => ({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: { message: 'Delete failed' } }),
      }));
      await expect(service.deleteBeneficiary('b1')).rejects.toThrow('Failed to delete beneficiary');
    });
  });
});
