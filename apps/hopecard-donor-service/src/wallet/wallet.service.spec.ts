import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { NotificationsService } from '../notifications/notifications.service';

const mockSupabaseRequest = jest.fn();
jest.mock('@app/common/supabase-helpers', () => ({
  supabaseRequest: (...args: any[]) => mockSupabaseRequest(...args),
}));
jest.mock('@implementsprint/sdk', () => ({ TribeClient: jest.fn() }));

const mockNotify = { createNotification: jest.fn().mockResolvedValue(undefined) };
const VALID_UUID = '11111111-1111-1111-1111-111111111111';

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(async () => {
    mockSupabaseRequest.mockReset();
    mockNotify.createNotification.mockReset();
    mockNotify.createNotification.mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: NotificationsService, useValue: mockNotify },
      ],
    }).compile();
    service = module.get<WalletService>(WalletService);
  });

  describe('getWalletBalance', () => {
    it('returns existing balance', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([{ wallet_balance: 500, currency: 'PHP' }]);
      const result = await service.getWalletBalance(VALID_UUID);
      expect(result).toEqual({ balance: 500, currency: 'PHP' });
    });

    it('creates wallet and returns 0 when not found', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([]); // no wallet
      mockSupabaseRequest.mockResolvedValueOnce({}); // insert
      const result = await service.getWalletBalance(VALID_UUID);
      expect(result).toEqual({ balance: 0, currency: 'PHP' });
    });

    it('throws 400 when authUserId is empty', async () => {
      await expect(service.getWalletBalance('')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 for invalid UUID', async () => {
      await expect(service.getWalletBalance('bad')).rejects.toMatchObject({ status: 400 });
    });

    it('wraps DB errors in HttpException', async () => {
      mockSupabaseRequest.mockRejectedValue(new Error('DB down'));
      await expect(service.getWalletBalance(VALID_UUID)).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('initiateTopUp', () => {
    it('returns mock checkout URL in non-production without client', async () => {
      process.env.NODE_ENV = 'test';
      const result = await service.initiateTopUp(VALID_UUID, 100, 'https://app.com/success', 'https://app.com/cancel');
      expect(result.checkoutUrl).toContain('https://app.com/success');
      expect(result.referenceId).toMatch(/^wallet-topup-/);
    });

    it('throws 503 in production without client', async () => {
      process.env.NODE_ENV = 'production';
      await expect(service.initiateTopUp(VALID_UUID, 100, 'url', 'url')).rejects.toMatchObject({ status: 503 });
      process.env.NODE_ENV = 'test';
    });

    it('throws 400 when authUserId is empty', async () => {
      await expect(service.initiateTopUp('', 100, 'url', 'url')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 for invalid UUID', async () => {
      await expect(service.initiateTopUp('bad', 100, 'url', 'url')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when amount is below minimum', async () => {
      await expect(service.initiateTopUp(VALID_UUID, 10, 'url', 'url')).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('confirmTopUp', () => {
    const validRef = `wallet-topup-11111111-${Date.now()}`;

    it('throws 400 when authUserId is empty', async () => {
      await expect(service.confirmTopUp('', validRef, 100)).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 for invalid UUID', async () => {
      await expect(service.confirmTopUp('bad', validRef, 100)).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when referenceId format is invalid', async () => {
      await expect(service.confirmTopUp(VALID_UUID, 'bad-ref', 100)).rejects.toMatchObject({ status: 400 });
    });

    it('throws 403 when referenceId belongs to another user', async () => {
      const otherRef = 'wallet-topup-22222222-1234567890123';
      await expect(service.confirmTopUp(VALID_UUID, otherRef, 100)).rejects.toMatchObject({ status: 403 });
    });

    it('credits wallet in mock mode and returns new balance', async () => {
      process.env.NODE_ENV = 'test';
      mockSupabaseRequest
        .mockResolvedValueOnce([]) // no existing transaction (replay check)
        .mockResolvedValueOnce([{ id: 'w1', wallet_balance: 500 }]) // wallet fetch
        .mockResolvedValueOnce({}) // insert transaction
        .mockResolvedValueOnce({}); // patch balance

      const ref = `wallet-topup-11111111-1234567890123`;
      const result = await service.confirmTopUp(VALID_UUID, ref, 100);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(600);
    });

    it('returns current balance when referenceId already credited', async () => {
      process.env.NODE_ENV = 'test';
      const ref = `wallet-topup-11111111-1234567890123`;
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: 'existing' }]) // already exists
        .mockResolvedValueOnce([{ wallet_balance: 700 }]); // current balance
      const result = await service.confirmTopUp(VALID_UUID, ref, 100);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(700);
    });

    it('throws 404 when wallet not found', async () => {
      process.env.NODE_ENV = 'test';
      const ref = `wallet-topup-11111111-1234567890123`;
      mockSupabaseRequest
        .mockResolvedValueOnce([]) // no existing transaction
        .mockResolvedValueOnce([]); // wallet not found
      await expect(service.confirmTopUp(VALID_UUID, ref, 100)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('donateFromWallet', () => {
    it('throws 400 when authUserId is empty', async () => {
      await expect(service.donateFromWallet('', 'ref', 100)).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when campaignId is empty', async () => {
      await expect(service.donateFromWallet(VALID_UUID, '', 100)).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when amount is 0', async () => {
      await expect(service.donateFromWallet(VALID_UUID, 'ref', 0)).rejects.toMatchObject({ status: 400 });
    });

    it('throws 402 when insufficient balance', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([{ id: 'w1', wallet_balance: 50 }]);
      await expect(service.donateFromWallet(VALID_UUID, 'ref', 200)).rejects.toMatchObject({ status: 402 });
    });

    it('deducts balance and returns new balance', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: 'w1', wallet_balance: 500 }]) // wallet
        .mockResolvedValueOnce([{ id: 'tx1' }]) // insert transaction
        .mockResolvedValueOnce({}); // patch balance
      const result = await service.donateFromWallet(VALID_UUID, 'camp-ref', 100);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(400);
      expect(result.transactionId).toBe('tx1');
    });

    it('throws 404 when wallet not found', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([]);
      await expect(service.donateFromWallet(VALID_UUID, 'ref', 100)).rejects.toMatchObject({ status: 404 });
    });

    it('throws 500 when transaction record creation fails', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: 'w1', wallet_balance: 500 }])
        .mockResolvedValueOnce([]); // no transaction returned
      await expect(service.donateFromWallet(VALID_UUID, 'ref', 100)).rejects.toMatchObject({ status: 500 });
    });
  });

  describe('getTransactionHistory', () => {
    it('returns transactions', async () => {
      const transactions = [{ id: 'tx1', type: 'topup', amount: 100, status: 'completed', description: 'Top-up', created_at: '2025-01-01' }];
      mockSupabaseRequest.mockResolvedValueOnce(transactions);
      const result = await service.getTransactionHistory(VALID_UUID);
      expect(result.transactions).toEqual(transactions);
    });

    it('throws 400 when authUserId is empty', async () => {
      await expect(service.getTransactionHistory('')).rejects.toMatchObject({ status: 400 });
    });

    it('wraps DB errors in HttpException', async () => {
      mockSupabaseRequest.mockRejectedValue(new Error('DB down'));
      await expect(service.getTransactionHistory(VALID_UUID)).rejects.toBeInstanceOf(HttpException);
    });
  });
});
