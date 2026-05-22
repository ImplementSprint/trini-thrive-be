import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProcedureEventService } from '@app/api-center';
import { CampaignsService } from './campaigns.service';

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();

const mockChain: any = {
  select: jest.fn(),
  eq: jest.fn(),
  in: jest.fn(),
  order: jest.fn(),
  limit: jest.fn(),
  update: jest.fn(),
  insert: jest.fn(),
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
};

const mockSupabase = { from: jest.fn() };
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const mockEmit = jest.fn();

const resetChain = () => {
  // Reset each method individually to clear once-queues, then restore defaults
  mockSingle.mockReset();
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockMaybeSingle.mockReset();
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockChain.select.mockReset();
  mockChain.select.mockReturnThis();
  mockChain.eq.mockReset();
  mockChain.eq.mockReturnThis();
  mockChain.in.mockReset();
  mockChain.in.mockReturnThis();
  mockChain.order.mockReset();
  mockChain.order.mockReturnThis();
  mockChain.limit.mockReset();
  mockChain.limit.mockReturnThis();
  mockChain.update.mockReset();
  mockChain.update.mockReturnThis();
  mockChain.insert.mockReset();
  mockChain.insert.mockReturnThis();
  mockEmit.mockReset();

  // Reset from() to clear any mockImplementation from previous tests
  mockSupabase.from.mockReset();
  mockSupabase.from.mockReturnValue(mockChain);
};

describe('CampaignsService', () => {
  let service: CampaignsService;

  beforeEach(async () => {
    resetChain();

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: ProcedureEventService, useValue: { emit: mockEmit } },
      ],
    }).compile();
    service = module.get<CampaignsService>(CampaignsService);
  });

  // ── getCampaigns ─────────────────────────────────────────────────────────────
  describe('getCampaigns', () => {
    it('returns empty campaigns when user has no enrollments', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      // enrollments: eq() is terminal → chain awaited = chain → data = undefined → []
      // count: last eq() is terminal → count = undefined → 0
      const result = await service.getCampaigns('uid-1');
      expect(result.campaigns).toEqual([]);
      expect(result.summary.total_support).toBe(0);
      expect(result.summary.pending_invitations).toBe(0);
    });

    it('returns campaigns when user is enrolled', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });

      // eq() call order: (1) getProfile, (2) enrollments terminal, (3) count intermediate, (4) count terminal
      mockChain.eq
        .mockReturnValueOnce(mockChain) // (1) getProfile's eq
        .mockResolvedValueOnce({ data: [{ campaign_id: 'c-1' }], error: null }) // (2) enrollments
        .mockReturnValueOnce(mockChain) // (3) count intermediate
        .mockResolvedValueOnce({ count: 1, data: null, error: null }); // (4) count terminal

      // in() for hc_campaigns query
      mockChain.in.mockResolvedValueOnce({
        data: [{ id: 'c-1', title: 'Camp', description: 'Help', category: 'health', status: 'active', target_amount: '10000', collected_amount: '5000' }],
        error: null,
      });

      const result = await service.getCampaigns('uid-1');
      expect(result.campaigns).toHaveLength(1);
      expect(result.summary.active_count).toBe(1);
      expect(result.summary.total_support).toBe(5000);
      expect(result.summary.pending_invitations).toBe(1);
    });

    it('throws BadRequestException when hc_campaigns query fails', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockChain.eq
        .mockReturnValueOnce(mockChain)
        .mockResolvedValueOnce({ data: [{ campaign_id: 'c-1' }], error: null });
      mockChain.in.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });

      await expect(service.getCampaigns('uid-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when profile not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      await expect(service.getCampaigns('uid-x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── getCampaign ──────────────────────────────────────────────────────────────
  describe('getCampaign', () => {
    it('returns campaign with manager info', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: { campaign_id: 'c-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'c-1', title: 'Camp', created_by: 'mgr-uid', collected_amount: '5000' }, error: null });
      mockMaybeSingle.mockResolvedValueOnce({
        data: { first_name: 'Alice', last_name: 'Smith', organization_name: 'Org', email: 'a@b.com', phone: '123' },
        error: null,
      });

      const result = await service.getCampaign('uid-1', 'c-1');
      expect(result.campaign.id).toBe('c-1');
      expect(result.manager?.full_name).toBe('Alice Smith');
      expect(result.total_received).toBe(5000);
    });

    it('returns campaign with null manager when no created_by', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: { campaign_id: 'c-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'c-1', title: 'Camp', created_by: null, collected_amount: '0' }, error: null });

      const result = await service.getCampaign('uid-1', 'c-1');
      expect(result.manager).toBeNull();
    });

    it('returns campaign with null manager when manager not in DB', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: { campaign_id: 'c-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'c-1', title: 'Camp', created_by: 'mgr-uid', collected_amount: '0' }, error: null });
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.getCampaign('uid-1', 'c-1');
      expect(result.manager).toBeNull();
    });

    it('throws NotFoundException when not enrolled in campaign', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null }); // no enrollment

      await expect(service.getCampaign('uid-1', 'c-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when campaign not found in hc_campaigns', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: { campaign_id: 'c-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      await expect(service.getCampaign('uid-1', 'c-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when profile not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'err' } });
      await expect(service.getCampaign('uid-x', 'c-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── getInvitations ───────────────────────────────────────────────────────────
  describe('getInvitations', () => {
    it('returns mapped invitations', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockChain.limit.mockResolvedValueOnce({
        data: [{
          id: 'inv-1',
          campaign_id: 'c-1',
          status: 'pending',
          invited_at: '2024-01-01T00:00:00Z',
          responded_at: null,
          hc_campaigns: { title: 'Camp', description: 'Help', category: 'health', status: 'active', target_amount: '10000', collected_amount: '5000' },
        }],
        error: null,
      });

      const result = await service.getInvitations('uid-1');
      expect(result.invitations).toHaveLength(1);
      expect(result.invitations[0].title).toBe('Camp');
      expect(result.invitations[0].target_amount).toBe(10000);
    });

    it('returns empty invitations when none pending', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      // limit() returns this by default; await chain = chain; data = undefined → []
      const result = await service.getInvitations('uid-1');
      expect(result.invitations).toEqual([]);
    });

    it('throws BadRequestException on invitations DB error', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockChain.limit.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });

      await expect(service.getInvitations('uid-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when profile not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'err' } });
      await expect(service.getInvitations('uid-x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── acceptInvitation ─────────────────────────────────────────────────────────
  describe('acceptInvitation', () => {
    it('accepts pending invitation and emits event', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'inv-1', campaign_id: 'c-1', status: 'pending' }, error: null });

      const result = await service.acceptInvitation('uid-1', 'inv-1');
      expect(result.success).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith(
        'hopecard.beneficiary.invitation_accepted',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('throws NotFoundException when profile not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'err' } });
      await expect(service.acceptInvitation('uid-x', 'inv-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when invitation not found', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      await expect(service.acceptInvitation('uid-1', 'inv-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when invitation already responded', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'inv-1', campaign_id: 'c-1', status: 'accepted' }, error: null });

      await expect(service.acceptInvitation('uid-1', 'inv-1')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── declineInvitation ────────────────────────────────────────────────────────
  describe('declineInvitation', () => {
    it('declines pending invitation and emits event', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'inv-1', status: 'pending' }, error: null });

      const result = await service.declineInvitation('uid-1', 'inv-1');
      expect(result.success).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith(
        'hopecard.beneficiary.invitation_declined',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('throws NotFoundException when invitation not found', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      await expect(service.declineInvitation('uid-1', 'inv-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when invitation already responded', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'inv-1', status: 'declined' }, error: null });

      await expect(service.declineInvitation('uid-1', 'inv-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws NotFoundException when profile not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'err' } });
      await expect(service.declineInvitation('uid-x', 'inv-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
