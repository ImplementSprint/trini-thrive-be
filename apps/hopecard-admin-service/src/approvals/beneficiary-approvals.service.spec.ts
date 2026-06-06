import { BeneficiaryApprovalsService } from './beneficiary-approvals.service';

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
 * Build a chain where:
 *  - select() can act as either a passthrough (returns this) or terminal (resolves)
 *  - single() / range() are always terminal resolves
 *  - update() / insert() / delete() / eq() / in() / order() return this
 *
 * The source does two flavours:
 *   (A) .from().select('*').order().range()          → range is terminal
 *   (B) .from().select('*').eq().single()            → single is terminal
 *   (C) .from().update().eq().select()               → select is terminal (update chain)
 *   (D) .from().insert([]).select()                  → select is terminal (insert chain)
 *
 * We handle (C)/(D) by detecting that an update/insert was called first; we use
 * a flag `_mutating` to switch select() from passthrough to terminal.
 */
const makeSbChain = (result: any) => {
  let mutating = false;
  const chain: any = {
    select: jest.fn().mockImplementation((..._args: any[]) => {
      if (mutating) {
        // terminal — return a thenable that resolves to result
        return Promise.resolve(result);
      }
      return chain; // passthrough
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

/** Convenience: a chain that resolves count query via select() immediately */
const makeCountChain = (count: number) => ({
  select: jest.fn().mockResolvedValue({ count, data: null, error: null }),
});

describe('BeneficiaryApprovalsService', () => {
  let service: BeneficiaryApprovalsService;
  let mockActivityLogger: any;
  let mockEvents: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockActivityLogger = { logActivity: jest.fn().mockResolvedValue(undefined) };
    mockEvents = { emit: jest.fn() };
    service = new BeneficiaryApprovalsService(mockActivityLogger, mockEvents);
  });

  // ── getAllApprovals ──────────────────────────────────────────────────────────
  describe('getAllApprovals', () => {
    it('returns paginated data with count on success', async () => {
      const s = getSupabase();
      const beneficiary = {
        id: 'b1',
        email: 'ben@test.com',
        id_verification_key: 'key',
        bank_name: 'BNK',
        account_number: '123',
        first_name: 'John',
        last_name: 'Doe',
      };

      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeCountChain(1);
        return makeSbChain({ data: [beneficiary], error: null });
      });

      const result = await service.getAllApprovals(1, 10);
      expect(result.total).toBe(1);
      expect(result.data.length).toBe(1);
      expect(result.data[0].documents_submitted).toBe(true);
      expect(result.data[0].bank_details_submitted).toBe(true);
    });

    it('returns empty data on supabase error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeCountChain(0);
        return makeSbChain({ data: null, error: { message: 'DB error' } });
      });

      const result = await service.getAllApprovals();
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('fetches email from auth.users when beneficiary has no email but has auth_user_id', async () => {
      const s = getSupabase();
      const beneficiary = {
        id: 'b2',
        email: null,
        auth_user_id: 'auth-uuid',
        id_verification_key: null,
        bank_name: null,
        account_number: null,
      };

      let callCount = 0;
      s.from.mockImplementation((table: string) => {
        callCount++;
        if (callCount === 1) return makeCountChain(1);
        if (table === 'beneficiary_profiles' && callCount === 2) {
          return makeSbChain({ data: [beneficiary], error: null });
        }
        // auth.users lookup → single()
        return makeSbChain({ data: { email: 'fetched@example.com' }, error: null });
      });

      const result = await service.getAllApprovals();
      expect(result.data[0]).toHaveProperty('email', 'fetched@example.com');
    });

    it('handles beneficiary with auth_user_id but no email found in auth', async () => {
      const s = getSupabase();
      const beneficiary = { id: 'b3', email: null, auth_user_id: 'auth-uuid', id_verification_key: null, bank_name: null, account_number: null };

      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeCountChain(1);
        if (callCount === 2) return makeSbChain({ data: [beneficiary], error: null });
        // auth.users lookup returns null
        return makeSbChain({ data: null, error: null });
      });

      const result = await service.getAllApprovals();
      expect(result.data[0].email).toBeNull();
    });

    it('returns empty data on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Unexpected'); });
      const result = await service.getAllApprovals();
      expect(result.data).toEqual([]);
    });
  });

  // ── approveBeneficiary ───────────────────────────────────────────────────────
  describe('approveBeneficiary', () => {
    it('returns success:true on happy path with email', async () => {
      const s = getSupabase();
      const profileData = { first_name: 'John', last_name: 'Doe' };
      const updatedRow = { email: 'john@test.com', status: 'approved' };

      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: profileData, error: null }); // fetch name
        return makeSbChain({ data: [updatedRow], error: null }); // update
      });

      const result = await service.approveBeneficiary('b1', 'admin-1', 'admin@test.com');
      expect(result.success).toBe(true);
      expect(result.message).toBe('Beneficiary approved successfully');
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'hopecard.beneficiary.approved',
        expect.objectContaining({ beneficiaryId: 'b1' }),
        expect.any(Object),
      );
      expect(getSendApprovalEmail()).toHaveBeenCalled();
    });

    it('returns success:false on update error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'J', last_name: 'D' }, error: null });
        return makeSbChain({ data: null, error: { message: 'Update failed' } });
      });

      const result = await service.approveBeneficiary('b1', 'admin-1');
      expect(result.success).toBe(false);
    });

    it('skips email when no email in updated row', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'J', last_name: 'D' }, error: null });
        return makeSbChain({ data: [{ status: 'approved' }], error: null }); // no email field
      });

      const result = await service.approveBeneficiary('b1', 'admin-1');
      expect(result.success).toBe(true);
      expect(getSendApprovalEmail()).not.toHaveBeenCalled();
    });

    it('returns success:false on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Kaboom'); });
      const result = await service.approveBeneficiary('b1', 'admin-1');
      expect(result.success).toBe(false);
    });
  });

  // ── rejectBeneficiary ────────────────────────────────────────────────────────
  describe('rejectBeneficiary', () => {
    it('returns success:true on happy path with reason', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'Jane', last_name: 'Smith' }, error: null });
        return makeSbChain({ data: [{ email: 'jane@test.com' }], error: null });
      });

      const result = await service.rejectBeneficiary('b2', 'admin-1', 'Incomplete docs', 'admin@test.com');
      expect(result.success).toBe(true);
      expect(getSendRejectionEmail()).toHaveBeenCalled();
    });

    it('returns success:true without reason (email with no reason in payload)', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'Jane', last_name: 'Smith' }, error: null });
        return makeSbChain({ data: [{ email: 'jane@test.com' }], error: null });
      });

      const result = await service.rejectBeneficiary('b2', 'admin-1');
      expect(result.success).toBe(true);
    });

    it('returns success:false on update error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'J', last_name: 'S' }, error: null });
        return makeSbChain({ data: null, error: { message: 'Reject fail' } });
      });

      const result = await service.rejectBeneficiary('b2', 'admin-1');
      expect(result.success).toBe(false);
    });

    it('returns success:false on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Crash'); });
      const result = await service.rejectBeneficiary('b2', 'admin-1');
      expect(result.success).toBe(false);
    });
  });

  // ── getApprovalHistory ───────────────────────────────────────────────────────
  describe('getApprovalHistory', () => {
    it('returns status on success', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => makeSbChain({ data: { status: 'approved' }, error: null }));
      const result = await service.getApprovalHistory('b1');
      expect(result.status).toBe('approved');
    });

    it('returns status:unknown on supabase error', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => makeSbChain({ data: null, error: { message: 'DB error' } }));
      const result = await service.getApprovalHistory('b1');
      expect(result.status).toBe('unknown');
    });

    it('returns status:unknown on null data', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => makeSbChain({ data: null, error: null }));
      const result = await service.getApprovalHistory('b1');
      expect(result.status).toBe('unknown');
    });

    it('returns status:unknown on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Crash'); });
      const result = await service.getApprovalHistory('b1');
      expect(result.status).toBe('unknown');
    });
  });

  // ── sendDonation ─────────────────────────────────────────────────────────────
  describe('sendDonation', () => {
    it('returns success:true on happy path', async () => {
      const s = getSupabase();
      const beneficiary = { first_name: 'John', last_name: 'Doe', email: 'john@test.com', allocated_amount: 100 };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: beneficiary, error: null }); // fetch beneficiary
        return makeSbChain({ data: [{ id: 'don1' }], error: null }); // insert donation
      });

      const result = await service.sendDonation('b1', 'admin-1', { amount: 500, campaign: 'General' });
      expect(result.success).toBe(true);
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'hopecard.beneficiary.donation.sent',
        expect.objectContaining({ amount: 500 }),
        expect.any(Object),
      );
    });

    it('returns success:false when beneficiary not found', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => makeSbChain({ data: null, error: null }));
      const result = await service.sendDonation('b1', 'admin-1', { amount: 100 });
      expect(result.success).toBe(false);
      expect(result.message).toBe('Beneficiary not found');
    });

    it('returns success:false on insert error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'J', last_name: 'D', email: 'j@t.com', allocated_amount: 0 }, error: null });
        return makeSbChain({ data: null, error: { message: 'Insert failed' } });
      });

      const result = await service.sendDonation('b1', 'admin-1', { amount: 100 });
      expect(result.success).toBe(false);
    });

    it('returns success:false on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Crash'); });
      const result = await service.sendDonation('b1', 'admin-1', { amount: 100 });
      expect(result.success).toBe(false);
    });
  });

  // ── approveDocument ──────────────────────────────────────────────────────────
  describe('approveDocument', () => {
    it('returns success:true on happy path', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'J', last_name: 'D' }, error: null });
        return makeSbChain({ data: [{ id: 'doc1' }], error: null });
      });

      const result = await service.approveDocument('b1', 'admin-1', 'admin@test.com');
      expect(result.success).toBe(true);
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'hopecard.beneficiary.document.approved',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('returns success:false on update error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'J', last_name: 'D' }, error: null });
        return makeSbChain({ data: null, error: { message: 'Error' } });
      });

      const result = await service.approveDocument('b1', 'admin-1');
      expect(result.success).toBe(false);
    });

    it('returns success:false on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Crash'); });
      const result = await service.approveDocument('b1', 'admin-1');
      expect(result.success).toBe(false);
    });
  });

  // ── rejectDocument ───────────────────────────────────────────────────────────
  describe('rejectDocument', () => {
    it('returns success:true on happy path', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'J', last_name: 'D' }, error: null });
        return makeSbChain({ data: [{ id: 'doc1' }], error: null });
      });

      const result = await service.rejectDocument('b1', 'admin-1', 'Bad doc');
      expect(result.success).toBe(true);
    });

    it('returns success:false on update error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'J', last_name: 'D' }, error: null });
        return makeSbChain({ data: null, error: { message: 'Error' } });
      });

      const result = await service.rejectDocument('b1', 'admin-1');
      expect(result.success).toBe(false);
    });

    it('returns success:false on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Crash'); });
      const result = await service.rejectDocument('b1', 'admin-1');
      expect(result.success).toBe(false);
    });
  });

  // ── approveBank ──────────────────────────────────────────────────────────────
  describe('approveBank', () => {
    it('returns success:true on happy path', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'J', last_name: 'D' }, error: null });
        return makeSbChain({ data: [{ id: 'bank1' }], error: null });
      });

      const result = await service.approveBank('b1', 'admin-1', 'admin@test.com');
      expect(result.success).toBe(true);
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'hopecard.beneficiary.bank.approved',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('returns success:false on update error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'J', last_name: 'D' }, error: null });
        return makeSbChain({ data: null, error: { message: 'Error' } });
      });

      const result = await service.approveBank('b1', 'admin-1');
      expect(result.success).toBe(false);
    });

    it('returns success:false on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Crash'); });
      const result = await service.approveBank('b1', 'admin-1');
      expect(result.success).toBe(false);
    });
  });

  // ── rejectBank ───────────────────────────────────────────────────────────────
  describe('rejectBank', () => {
    it('returns success:true on happy path with reason', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'J', last_name: 'D' }, error: null });
        return makeSbChain({ data: [{ id: 'bank1' }], error: null });
      });

      const result = await service.rejectBank('b1', 'admin-1', 'Invalid account', 'admin@test.com');
      expect(result.success).toBe(true);
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'hopecard.beneficiary.bank.rejected',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('returns success:false on update error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSbChain({ data: { first_name: 'J', last_name: 'D' }, error: null });
        return makeSbChain({ data: null, error: { message: 'Error' } });
      });

      const result = await service.rejectBank('b1', 'admin-1');
      expect(result.success).toBe(false);
    });

    it('returns success:false on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Crash'); });
      const result = await service.rejectBank('b1', 'admin-1');
      expect(result.success).toBe(false);
    });
  });

  // ── getDocumentApprovals ─────────────────────────────────────────────────────
  describe('getDocumentApprovals', () => {
    it('returns formatted data on success', async () => {
      const s = getSupabase();
      const docRow = {
        id: 'doc1',
        status: 'pending',
        beneficiary_profiles: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@test.com',
          hc_campaigns: { title: 'Campaign A' },
        },
      };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeCountChain(1);
        return makeSbChain({ data: [docRow], error: null });
      });

      const result = await service.getDocumentApprovals(1, 10);
      expect(result.data[0].beneficiary_name).toBe('John Doe');
      expect(result.data[0].campaign_title).toBe('Campaign A');
    });

    it('returns empty data on supabase error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeCountChain(0);
        return makeSbChain({ data: null, error: { message: 'DB error' } });
      });

      const result = await service.getDocumentApprovals();
      expect(result.data).toEqual([]);
    });

    it('returns empty data on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Crash'); });
      const result = await service.getDocumentApprovals();
      expect(result.data).toEqual([]);
    });

    it('uses fallback values when profile is null', async () => {
      const s = getSupabase();
      const docRow = { id: 'doc2', status: 'pending', beneficiary_profiles: null };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeCountChain(1);
        return makeSbChain({ data: [docRow], error: null });
      });

      const result = await service.getDocumentApprovals();
      expect(result.data[0].beneficiary_name).toBe('Unknown Beneficiary');
      expect(result.data[0].beneficiary_email).toBe('No Email');
      expect(result.data[0].campaign_title).toBe('N/A');
    });
  });

  // ── getBankApprovals ─────────────────────────────────────────────────────────
  describe('getBankApprovals', () => {
    it('returns formatted data on success with is_active true', async () => {
      const s = getSupabase();
      const bankRow = {
        id: 'bank1',
        is_active: true,
        beneficiary_profiles: {
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@test.com',
          hc_campaigns: { title: 'Campaign B' },
        },
      };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeCountChain(1);
        return makeSbChain({ data: [bankRow], error: null });
      });

      const result = await service.getBankApprovals(1, 10);
      expect(result.data[0].status).toBe('approved');
      expect(result.data[0].beneficiary_email).toBe('jane@test.com');
    });

    it('maps is_active:false to status:pending', async () => {
      const s = getSupabase();
      const bankRow = {
        id: 'bank2',
        is_active: false,
        beneficiary_profiles: { first_name: 'Bob', last_name: 'Jones', email: null, hc_campaigns: null },
      };
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeCountChain(1);
        return makeSbChain({ data: [bankRow], error: null });
      });

      const result = await service.getBankApprovals();
      expect(result.data[0].status).toBe('pending');
      expect(result.data[0].campaign_title).toBe('N/A');
    });

    it('returns empty data on supabase error', async () => {
      const s = getSupabase();
      let callCount = 0;
      s.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeCountChain(0);
        return makeSbChain({ data: null, error: { message: 'DB error' } });
      });

      const result = await service.getBankApprovals();
      expect(result.data).toEqual([]);
    });

    it('returns empty data on thrown exception', async () => {
      const s = getSupabase();
      s.from.mockImplementation(() => { throw new Error('Crash'); });
      const result = await service.getBankApprovals();
      expect(result.data).toEqual([]);
    });
  });
});
