import { CampaignManagerApprovalsService } from './campaign-manager-approvals.service';

jest.mock('@app/common/supabase-client', () => ({
  supabase: {
    auth: { admin: { listUsers: jest.fn() } },
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

jest.mock('@app/common/email', () => ({
  sendApprovalEmail: jest.fn().mockResolvedValue(true),
  sendRejectionEmail: jest.fn().mockResolvedValue(true),
}));

const getSupabase = () =>
  (require('@app/common/supabase-client') as { supabase: any }).supabase;
const getSendApprovalEmail = () =>
  (require('@app/common/email') as { sendApprovalEmail: jest.Mock }).sendApprovalEmail;
const getSendRejectionEmail = () =>
  (require('@app/common/email') as { sendRejectionEmail: jest.Mock }).sendRejectionEmail;

/**
 * Chainable mock that detects mutating calls (update/insert/delete) and switches
 * select() to a terminal resolved promise instead of returning `this`.
 */
const makeSbChain = (result: any) => {
  let mutating = false;
  const chain: any = {
    select: jest.fn().mockImplementation((..._args: any[]) => {
      if (mutating) return Promise.resolve(result);
      return chain;
    }),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    update: jest.fn().mockImplementation(() => { mutating = true; return chain; }),
    insert: jest.fn().mockImplementation(() => { mutating = true; return chain; }),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue(result),
    in: jest.fn().mockReturnThis(),
    delete: jest.fn().mockImplementation(() => { mutating = true; return chain; }),
  };
  return chain;
};

/** Count query: select() resolves immediately */
const makeCountChain = (count: number, inResult?: any) => ({
  select: jest.fn().mockReturnThis(),
  in: jest.fn().mockResolvedValue({ count, data: null, error: null, ...(inResult || {}) }),
});

describe('CampaignManagerApprovalsService', () => {
  let service: CampaignManagerApprovalsService;
  let mockActivityLogger: any;
  let mockEvents: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockActivityLogger = { logActivity: jest.fn().mockResolvedValue(undefined) };
    mockEvents = { emit: jest.fn() };
    service = new CampaignManagerApprovalsService(mockActivityLogger, mockEvents);
  });

  // ── getAllApprovals ──────────────────────────────────────────────────────────
  describe('getAllApprovals', () => {
    it('returns empty result when no confirmed users exist', async () => {
      const s = getSupabase();
      s.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
      });

      const result = await service.getAllApprovals();
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns empty result when all users are unconfirmed', async () => {
      const s = getSupabase();
      s.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'uid-1', email_confirmed_at: null }] },
      });

      const result = await service.getAllApprovals();
      expect(result.data).toEqual([]);
    });

    it('returns paginated managers on success with email present', async () => {
      const s = getSupabase();
      s.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'uid-1', email_confirmed_at: '2024-01-01' }] },
      });

      const manager = {
        id: 'mgr1',
        email: 'mgr@test.com',
        auth_user_id: 'uid-1',
        status: 'pending',
        organization_name: 'Org Inc',
        sec_registration: 'SEC-001',
        organizational_certificate: null,
      };

      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeCountChain(1);
        // paginated query
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockResolvedValue({ data: [manager], error: null }),
        };
      });

      const result = await service.getAllApprovals(1, 10);
      expect(result.data.length).toBe(1);
      expect(result.data[0].email).toBe('mgr@test.com');
    });

    it('fetches email from auth.users when manager has no email but has auth_user_id', async () => {
      const s = getSupabase();
      s.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'uid-2', email_confirmed_at: '2024-01-01' }] },
      });

      const manager = {
        id: 'mgr2',
        email: null,
        auth_user_id: 'uid-2',
        status: 'pending',
        organization_name: 'Org2',
        sec_registration: null,
        organizational_certificate: null,
      };

      let callCount = 0;
      s.from.mockImplementation((table: string) => {
        callCount++;
        if (callCount === 1) return makeCountChain(1);
        if (table === 'campaign_manager_profiles' && callCount === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockResolvedValue({ data: [manager], error: null }),
          };
        }
        // auth.users lookup
        return makeSbChain({ data: { email: 'fetched@example.com' }, error: null });
      });

      const result = await service.getAllApprovals();
      expect(result).toBeDefined();
      expect(result.data[0].email).toBe('fetched@example.com');
    });

    it('handles manager with auth_user_id but no email found in auth', async () => {
      const s = getSupabase();
      s.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'uid-3', email_confirmed_at: '2024-01-01' }] },
      });
      const manager = { id: 'mgr3', email: null, auth_user_id: 'uid-3', status: 'pending', organization_name: 'Org3', sec_registration: null, organizational_certificate: null };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeCountChain(1);
        if (callCount === 2) {
          return { select: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), range: jest.fn().mockResolvedValue({ data: [manager], error: null }) };
        }
        return makeSbChain({ data: null, error: null });
      });
      const result = await service.getAllApprovals();
      expect(result.data[0].email).toBeNull();
    });

    it('returns empty data on paginated query error', async () => {
      const s = getSupabase();
      s.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'uid-1', email_confirmed_at: '2024-01-01' }] },
      });

      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeCountChain(0);
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        };
      });

      const result = await service.getAllApprovals();
      expect(result.data).toEqual([]);
    });

    it('returns empty data on thrown exception', async () => {
      const s = getSupabase();
      s.auth.admin.listUsers.mockRejectedValue(new Error('Auth crash'));
      const result = await service.getAllApprovals();
      expect(result.data).toEqual([]);
    });
  });

  // ── approveCampaignManager ───────────────────────────────────────────────────
  describe('approveCampaignManager', () => {
    it('returns success:true on happy path with email', async () => {
      const s = getSupabase();
      const managerData = { first_name: 'Alice', last_name: 'Wong', email: 'alice@test.com' };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: managerData, error: null });
        return makeSbChain({ data: [{ id: 'mgr1', email: 'alice@test.com' }], error: null });
      });

      const result = await service.approveCampaignManager('mgr1', 'admin-1');
      expect(result.success).toBe(true);
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'hopecard.campaign_manager.approved',
        expect.objectContaining({ campaignManagerId: 'mgr1' }),
        expect.any(Object),
      );
      expect(getSendApprovalEmail()).toHaveBeenCalled();
    });

    it('returns success:false on update error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'A', last_name: 'W', email: null }, error: null });
        return makeSbChain({ data: null, error: { message: 'Update failed' } });
      });

      const result = await service.approveCampaignManager('mgr1', 'admin-1');
      expect(result.success).toBe(false);
    });

    it('skips email when no email available', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'A', last_name: 'W', email: null }, error: null });
        return makeSbChain({ data: [{ id: 'mgr1' }], error: null }); // no email on updated row either
      });

      const result = await service.approveCampaignManager('mgr1', 'admin-1');
      expect(result.success).toBe(true);
      expect(getSendApprovalEmail()).not.toHaveBeenCalled();
    });

    it('returns success:false on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Crash'); });
      const result = await service.approveCampaignManager('mgr1', 'admin-1');
      expect(result.success).toBe(false);
    });
  });

  // ── rejectCampaignManager ────────────────────────────────────────────────────
  describe('rejectCampaignManager', () => {
    it('returns success:true on happy path with reason and email', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'Bob', last_name: 'Lee', email: 'bob@test.com' }, error: null });
        return makeSbChain({ data: [{ id: 'mgr2', email: 'bob@test.com' }], error: null });
      });

      const result = await service.rejectCampaignManager('mgr2', 'admin-1', 'Incomplete documents');
      expect(result.success).toBe(true);
      expect(getSendRejectionEmail()).toHaveBeenCalled();
    });

    it('returns success:true without reason (no reason in rejection payload)', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'Bob', last_name: 'Lee', email: 'bob@test.com' }, error: null });
        return makeSbChain({ data: [{ id: 'mgr2', email: 'bob@test.com' }], error: null });
      });

      const result = await service.rejectCampaignManager('mgr2', 'admin-1');
      expect(result.success).toBe(true);
    });

    it('returns success:false on update error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'B', last_name: 'L', email: null }, error: null });
        return makeSbChain({ data: null, error: { message: 'Reject failed' } });
      });

      const result = await service.rejectCampaignManager('mgr2', 'admin-1', 'reason');
      expect(result.success).toBe(false);
    });

    it('returns success:false on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Crash'); });
      const result = await service.rejectCampaignManager('mgr2', 'admin-1');
      expect(result.success).toBe(false);
    });
  });

  // ── getApprovalHistory ───────────────────────────────────────────────────────
  describe('getApprovalHistory', () => {
    it('returns status on success', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => makeSbChain({ data: { status: 'approved' }, error: null }));
      const result = await service.getApprovalHistory('mgr1');
      expect(result.status).toBe('approved');
    });

    it('returns status:unknown on supabase error', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => makeSbChain({ data: null, error: { message: 'DB error' } }));
      const result = await service.getApprovalHistory('mgr1');
      expect(result.status).toBe('unknown');
    });

    it('returns status:unknown on null data', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => makeSbChain({ data: null, error: null }));
      const result = await service.getApprovalHistory('mgr1');
      expect(result.status).toBe('unknown');
    });

    it('returns status:unknown on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Crash'); });
      const result = await service.getApprovalHistory('mgr1');
      expect(result.status).toBe('unknown');
    });
  });
});
