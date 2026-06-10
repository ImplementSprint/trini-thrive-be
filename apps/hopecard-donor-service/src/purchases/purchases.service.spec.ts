import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ProcedureEventService } from '@app/api-center';
import { PurchasesService } from './purchases.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';

const mockSupabaseRequest = jest.fn();
jest.mock('@app/common/supabase-helpers', () => ({
  supabaseRequest: (...args: any[]) => mockSupabaseRequest(...args),
}));
jest.mock('@implementsprint/sdk', () => ({ TribeClient: jest.fn() }));
jest.mock('../wallet/wallet.service');
jest.mock('../notifications/notifications.service');

const mockEmit = jest.fn();
const mockWallet = { donateFromWallet: jest.fn(), getWalletBalance: jest.fn() };
const mockNotify = { createNotification: jest.fn().mockResolvedValue(undefined) };
const VALID_UUID = '11111111-1111-1111-1111-111111111111';

describe('PurchasesService', () => {
  let service: PurchasesService;

  beforeEach(async () => {
    mockSupabaseRequest.mockReset();
    mockEmit.mockReset();
    mockWallet.donateFromWallet.mockReset();
    mockWallet.getWalletBalance.mockReset();
    mockNotify.createNotification.mockReset();
    mockNotify.createNotification.mockResolvedValue(undefined);
    process.env.NODE_ENV = 'test';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        { provide: ProcedureEventService, useValue: { emit: mockEmit } },
        { provide: WalletService, useValue: mockWallet },
        { provide: NotificationsService, useValue: mockNotify },
      ],
    }).compile();
    service = module.get<PurchasesService>(PurchasesService);
  });

  describe('getCheckoutSession', () => {
    it('returns mock session in test mode when no client', async () => {
      const result = await service.getCheckoutSession('mock-checkout-123');
      expect(result.session).toMatchObject({ status: 'paid', checkoutId: 'mock-checkout-123' });
    });

    it('throws 503 in production mode when no client', async () => {
      process.env.NODE_ENV = 'production';
      await expect(service.getCheckoutSession('any-id')).rejects.toMatchObject({ status: 503 });
      process.env.NODE_ENV = 'test';
    });
  });

  describe('cancelCheckoutSession', () => {
    it('returns success for mock checkout in test mode', async () => {
      const result = await service.cancelCheckoutSession('mock-checkout-456');
      expect(result).toEqual({ success: true });
    });

    it('throws 503 in production mode when no client', async () => {
      process.env.NODE_ENV = 'production';
      await expect(service.cancelCheckoutSession('any')).rejects.toMatchObject({ status: 503 });
      process.env.NODE_ENV = 'test';
    });
  });

  describe('getPurchases', () => {
    it('throws 400 for invalid UUID', async () => {
      await expect(service.getPurchases('bad')).rejects.toMatchObject({ status: 400 });
    });

    it('returns purchases list', async () => {
      const purchases = [{ id: 'p1', hopecard_id: 'c1', amount_paid: 500, payment_method: 'card', payment_reference: 'ref', status: 'paid', purchased_at: '2025-01-01' }];
      mockSupabaseRequest.mockResolvedValueOnce(purchases);
      const result = await service.getPurchases(VALID_UUID);
      expect(result.purchases).toEqual(purchases);
    });
  });

  describe('createCheckoutSession', () => {
    it('throws 400 for invalid authUserId', async () => {
      await expect(service.createCheckoutSession('bad', 'url', 'url')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 404 when no active cart', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([]); // no cart
      await expect(service.createCheckoutSession(VALID_UUID, 'url', 'url')).rejects.toMatchObject({ status: 404 });
    });

    it('throws 400 when cart is empty', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: 'cart-1' }]) // cart found
        .mockResolvedValueOnce([]); // no items
      await expect(service.createCheckoutSession(VALID_UUID, 'url', 'url')).rejects.toMatchObject({ status: 400 });
    });

    it('returns mock checkout in test mode when no client', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: 'cart-1' }]) // cart
        .mockResolvedValueOnce([{ id: 'i1', campaign_id: 'c1', face_value: 500, quantity: 1 }]) // items
        .mockResolvedValueOnce([{ id: 'c1', title: 'Camp' }]); // campaigns
      const result = await service.createCheckoutSession(VALID_UUID, 'https://app.com/success', 'https://app.com/cancel');
      expect(result.checkoutId).toContain('mock-checkout-');
      expect(result.subtotal).toBe(500);
    });
  });

  describe('confirmPurchase', () => {
    it('throws 400 for invalid authUserId', async () => {
      await expect(service.confirmPurchase('bad', 'chk', '')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when both checkoutId and referenceId are empty', async () => {
      await expect(service.confirmPurchase(VALID_UUID, '', '')).rejects.toMatchObject({ status: 400 });
    });

    it('confirms purchase in test mode and records in DB', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: 'cart-1' }]) // fetch cart
        .mockResolvedValueOnce([{ id: 'i1', campaign_id: 'c1', face_value: 500, quantity: 1 }]) // items
        .mockResolvedValueOnce({}) // insert purchase
        .mockResolvedValueOnce({}) // delete cart items
        .mockResolvedValueOnce({}); // patch cart
      const result = await service.confirmPurchase(VALID_UUID, 'mock-checkout-123', '');
      expect(result.success).toBe(true);
      expect(result.purchasedCount).toBe(1);
      expect(mockEmit).toHaveBeenCalledWith('hopecard.donation.completed', expect.any(Object), expect.any(Object));
    });

    it('throws 503 in production mode when no client', async () => {
      process.env.NODE_ENV = 'production';
      await expect(service.confirmPurchase(VALID_UUID, 'non-mock-id', '')).rejects.toMatchObject({ status: 503 });
      process.env.NODE_ENV = 'test';
    });
  });

  describe('purchaseFromWallet', () => {
    it('throws 400 when authUserId is empty', async () => {
      await expect(service.purchaseFromWallet('', [], [])).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 for invalid UUID format', async () => {
      await expect(service.purchaseFromWallet('bad', [], [])).rejects.toMatchObject({ status: 400 });
    });

    it('throws 404 when no active cart', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([]); // no cart
      await expect(service.purchaseFromWallet(VALID_UUID, [], [])).rejects.toMatchObject({ status: 404 });
    });

    it('throws 400 when cart is empty', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: 'cart-1' }])
        .mockResolvedValueOnce([]); // no items
      await expect(service.purchaseFromWallet(VALID_UUID, [], [])).rejects.toMatchObject({ status: 400 });
    });
  });
});
