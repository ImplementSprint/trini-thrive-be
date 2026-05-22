import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProcedureEventService } from '@app/api-center';
import { BankAccountsService } from './bank-accounts.service';

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

// ── ProcedureEventService mock ────────────────────────────────────────────────
const mockEmit = jest.fn();

describe('BankAccountsService', () => {
  let service: BankAccountsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockChain.select.mockReturnThis();
    mockChain.eq.mockReturnThis();
    mockChain.update.mockReturnThis();
    mockChain.delete.mockReturnThis();
    mockChain.insert.mockReturnThis();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankAccountsService,
        { provide: ProcedureEventService, useValue: { emit: mockEmit } },
      ],
    }).compile();
    service = module.get<BankAccountsService>(BankAccountsService);
  });

  // ── getAccounts ─────────────────────────────────────────────────────────────
  describe('getAccounts', () => {
    it('returns accounts list on success', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockOrder.mockResolvedValueOnce({ data: [{ id: 'acc-1', bank_name: 'BDO' }], error: null });

      const result = await service.getAccounts('uid-1');
      expect(result.accounts).toHaveLength(1);
    });

    it('returns empty array when no accounts', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockOrder.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.getAccounts('uid-1');
      expect(result.accounts).toEqual([]);
    });

    it('throws NotFoundException when profile not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      await expect(service.getAccounts('uid-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException on DB error fetching accounts', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });
      await expect(service.getAccounts('uid-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── createAccount ───────────────────────────────────────────────────────────
  describe('createAccount', () => {
    it('throws BadRequestException for missing bank_name', async () => {
      await expect(
        service.createAccount('uid-1', { bank_name: '', account_holder_name: 'Jane', account_number: '123' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException for missing account_holder_name', async () => {
      await expect(
        service.createAccount('uid-1', { bank_name: 'BDO', account_holder_name: '', account_number: '123' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException for missing account_number', async () => {
      await expect(
        service.createAccount('uid-1', { bank_name: 'BDO', account_holder_name: 'Jane', account_number: '' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when profile not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      await expect(
        service.createAccount('uid-x', { bank_name: 'BDO', account_holder_name: 'Jane', account_number: '123' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates account and emits event', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null }) // getProfile
        .mockResolvedValueOnce({ data: { id: 'acc-new', bank_name: 'BDO' }, error: null }); // insert result

      const result = await service.createAccount('uid-1', {
        bank_name: 'BDO',
        account_holder_name: 'Jane Doe',
        account_number: '1234567890',
      });

      expect(result.account).toBeDefined();
      expect(mockEmit).toHaveBeenCalledWith(
        'hopecard.bank_account.submitted',
        expect.objectContaining({ bankName: 'BDO' }),
        expect.any(Object),
      );
    });

    it('throws BadRequestException when insert fails', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null }) // getProfile
        .mockResolvedValueOnce({ data: null, error: { message: 'insert error' } }); // insert fails

      await expect(
        service.createAccount('uid-1', {
          bank_name: 'BDO',
          account_holder_name: 'Jane Doe',
          account_number: '1234567890',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── updateAccount ───────────────────────────────────────────────────────────
  describe('updateAccount', () => {
    it('updates account and emits event', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null }) // getProfile
        .mockResolvedValueOnce({ data: { id: 'acc-1', bank_name: 'BPI' }, error: null }); // update result

      const result = await service.updateAccount('uid-1', 'acc-1', { bank_name: 'BPI' });
      expect(result.account).toBeDefined();
      expect(mockEmit).toHaveBeenCalledWith(
        'hopecard.bank_account.updated',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('throws NotFoundException when profile not found on update', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      await expect(service.updateAccount('uid-x', 'acc-1', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when update query fails', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null }) // getProfile
        .mockResolvedValueOnce({ data: null, error: { message: 'update error' } }); // update fails

      await expect(service.updateAccount('uid-1', 'acc-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── deleteAccount ───────────────────────────────────────────────────────────
  describe('deleteAccount', () => {
    it('soft-deletes account and emits event', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null }); // getProfile

      const result = await service.deleteAccount('uid-1', 'acc-1');
      expect(result.success).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith(
        'hopecard.bank_account.deleted',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('throws NotFoundException when profile not found on delete', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      await expect(service.deleteAccount('uid-x', 'acc-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when delete update fails', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null }); // getProfile
      // make last eq in delete chain return an error
      mockChain.eq
        .mockReturnValueOnce(mockChain) // getProfile's .eq(auth_user_id)
        .mockReturnValueOnce(mockChain) // deleteAccount's .eq(id)
        .mockResolvedValueOnce({ error: { message: 'delete error' } }); // deleteAccount's last .eq(beneficiary_profile_id)

      await expect(service.deleteAccount('uid-1', 'acc-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
