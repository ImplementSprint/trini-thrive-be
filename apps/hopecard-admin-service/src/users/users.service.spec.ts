import { UsersService } from './users.service';

jest.mock('@app/common/supabase-client', () => ({
  supabase: {
    auth: { admin: { signOut: jest.fn() } },
    from: jest.fn(),
  },
}));

jest.mock('@app/common/activity-logger', () => ({
  ActivityLogger: jest.fn().mockImplementation(() => ({
    logActivity: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@app/common/email', () => ({
  sendAccountStatusEmail: jest.fn().mockResolvedValue(true),
  sendAccountReactivationEmail: jest.fn().mockResolvedValue(true),
}));

const getSupabase = () =>
  (require('@app/common/supabase-client') as { supabase: any }).supabase;
const getSendAccountStatusEmail = () =>
  (require('@app/common/email') as { sendAccountStatusEmail: jest.Mock }).sendAccountStatusEmail;
const getSendAccountReactivationEmail = () =>
  (require('@app/common/email') as { sendAccountReactivationEmail: jest.Mock }).sendAccountReactivationEmail;

// Standard chainable mock
const makeSbChain = (result: any) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue(result),
  update: jest.fn().mockReturnThis(),
  in: jest.fn().mockResolvedValue(result),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockResolvedValue(result),
});

describe('UsersService', () => {
  let service: UsersService;
  let mockActivityLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockActivityLogger = { logActivity: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(mockActivityLogger);
  });

  // ── getAllUsers ──────────────────────────────────────────────────────────────
  describe('getAllUsers', () => {
    it('queries all three tables when no role filter provided', async () => {
      const s = getSupabase();
      const donorRow = { id: 'd1', auth_user_id: 'au1', first_name: 'Donor', last_name: 'One', email: 'donor@test.com', status: 'active', created_at: '2024-01-03' };
      const benefRow = { id: 'b1', auth_user_id: 'au2', first_name: 'Ben', last_name: 'Two', email: 'ben@test.com', status: 'approved', created_at: '2024-01-02' };
      const mgrRow  = { id: 'm1', auth_user_id: 'au3', first_name: 'Mgr', last_name: 'Three', email: 'mgr@test.com', status: 'active', created_at: '2024-01-01' };

      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        const rows = callCount === 1 ? [donorRow] : callCount === 2 ? [benefRow] : [mgrRow];
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: rows, error: null, count: 1 }),
        };
      });

      const result = await service.getAllUsers(1, 10);
      expect(result.data.length).toBe(3);
      expect(result.total).toBe(3);
      // Should be sorted descending by created_at
      expect(result.data[0].first_name).toBe('Donor');
    });

    it('queries only the filtered table when role filter is provided', async () => {
      const s = getSupabase();
      const benefRow = { id: 'b1', auth_user_id: 'au2', first_name: 'Ben', last_name: 'Two', email: 'ben@test.com', status: 'approved', created_at: '2024-01-01' };

      s.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [benefRow], error: null, count: 1 }),
      }));

      const result = await service.getAllUsers(1, 10, 'Beneficiary');
      expect(s.from).toHaveBeenCalledTimes(1);
      expect(s.from).toHaveBeenCalledWith('beneficiary_profiles');
      expect(result.data[0].role).toBe('Beneficiary');
    });

    it('skips tables that return errors and accumulates only successful results', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Error on first table
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' }, count: 0 }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
        };
      });

      const result = await service.getAllUsers();
      expect(result.data).toEqual([]);
    });

    it('throws on unexpected exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Crash'); });
      await expect(service.getAllUsers()).rejects.toThrow('Crash');
    });
  });

  // ── updateUserStatus ─────────────────────────────────────────────────────────
  describe('updateUserStatus', () => {
    it('returns success:false for invalid role', async () => {
      const result = await service.updateUserStatus('uid', 'banned', 'test', 'UnknownRole');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid role provided');
    });

    it('returns success:false when user not found', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => makeSbChain({ data: null, error: { message: 'Not found' } }));
      const result = await service.updateUserStatus('uid', 'banned', 'reason', 'Donor');
      expect(result.success).toBe(false);
      expect(result.message).toContain('User not found');
    });

    it('returns success:true when status is unchanged', async () => {
      const s = getSupabase();
      const user = { auth_user_id: 'au1', status: 'banned', email: 'u@test.com', first_name: 'U' };
      s.from.mockImplementation(() => makeSbChain({ data: user, error: null }));
      const result = await service.updateUserStatus('uid', 'banned', 'reason', 'Donor');
      expect(result.success).toBe(true);
      expect(result.message).toBe('User status unchanged');
    });

    it('bans a user, invalidates sessions and sends status email', async () => {
      const s = getSupabase();
      const user = { auth_user_id: 'au1', status: 'active', email: 'u@test.com', first_name: 'User' };
      const updated = { ...user, status: 'banned' };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: user, error: null });
        // update call with .single()
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: updated, error: null }),
        };
      });
      s.auth.admin.signOut.mockResolvedValue({});

      const result = await service.updateUserStatus('uid', 'banned', 'Policy violation', 'Donor', 'admin-1');
      expect(result.success).toBe(true);
      expect(s.auth.admin.signOut).toHaveBeenCalledWith('au1', 'global');
      expect(getSendAccountStatusEmail()).toHaveBeenCalled();
      expect(mockActivityLogger.logActivity).toHaveBeenCalled();
    });

    it('suspends a user and sends status email', async () => {
      const s = getSupabase();
      const user = { auth_user_id: 'au1', status: 'active', email: 'u@test.com', first_name: 'User' };
      const updated = { ...user, status: 'suspended' };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: user, error: null });
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: updated, error: null }),
        };
      });
      s.auth.admin.signOut.mockResolvedValue({});

      const result = await service.updateUserStatus('uid', 'suspended', 'Temp ban', 'Beneficiary', 'admin-1', '2024-12-31');
      expect(result.success).toBe(true);
      expect(getSendAccountStatusEmail()).toHaveBeenCalled();
    });

    it('reactivates a user and sends reactivation email', async () => {
      const s = getSupabase();
      const user = { auth_user_id: 'au1', status: 'suspended', email: 'u@test.com', first_name: 'User' };
      const updated = { ...user, status: 'active' };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: user, error: null });
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: updated, error: null }),
        };
      });

      const result = await service.updateUserStatus('uid', 'active', 'Good behaviour', 'Campaign Manager', 'admin-1');
      expect(result.success).toBe(true);
      expect(getSendAccountReactivationEmail()).toHaveBeenCalled();
    });

    it('skips email when user has no email', async () => {
      const s = getSupabase();
      const user = { auth_user_id: 'au1', status: 'active', email: null, first_name: 'NoEmail' };
      const updated = { ...user, status: 'banned' };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: user, error: null });
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: updated, error: null }),
        };
      });
      s.auth.admin.signOut.mockResolvedValue({});

      const result = await service.updateUserStatus('uid', 'banned', 'reason', 'Donor', 'admin-1');
      expect(result.success).toBe(true);
      expect(getSendAccountStatusEmail()).not.toHaveBeenCalled();
    });

    it('returns success:false when update fails', async () => {
      const s = getSupabase();
      const user = { auth_user_id: 'au1', status: 'active', email: 'u@t.com', first_name: 'U' };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: user, error: null });
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
        };
      });

      const result = await service.updateUserStatus('uid', 'banned', 'reason', 'Donor');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to update user');
    });

    it('returns success:false on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('DB crash'); });
      const result = await service.updateUserStatus('uid', 'banned', 'reason', 'Donor');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error:');
    });
  });
});
