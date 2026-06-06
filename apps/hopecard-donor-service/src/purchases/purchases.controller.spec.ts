jest.mock('jose', () => ({ jwtVerify: jest.fn(), SignJWT: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

const mockService = {
  createCheckoutSession: jest.fn(),
  getCheckoutSession: jest.fn(),
  cancelCheckoutSession: jest.fn(),
  confirmPurchase: jest.fn(),
  getPurchases: jest.fn(),
  purchaseFromWallet: jest.fn(),
};
const req = { user: { sub: 'user-uuid' } } as any;

describe('PurchasesController', () => {
  let controller: PurchasesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchasesController],
      providers: [{ provide: PurchasesService, useValue: mockService }],
    }).compile();
    controller = module.get<PurchasesController>(PurchasesController);
  });

  it('createCheckout uses default URLs when not provided', async () => {
    mockService.createCheckoutSession.mockResolvedValue({ checkoutUrl: 'https://pay.example.com' });
    await controller.createCheckout(req, {});
    expect(mockService.createCheckoutSession).toHaveBeenCalledWith(
      'user-uuid',
      'http://localhost:3001/donor/payment/success',
      'http://localhost:3001/donor/payment/cancel',
    );
  });

  it('createCheckout uses provided successBaseUrl', async () => {
    mockService.createCheckoutSession.mockResolvedValue({ checkoutUrl: 'https://pay.example.com' });
    await controller.createCheckout(req, { successBaseUrl: 'https://myapp.com/success', cancelUrl: 'https://myapp.com/cancel' });
    expect(mockService.createCheckoutSession).toHaveBeenCalledWith(
      'user-uuid', 'https://myapp.com/success', 'https://myapp.com/cancel',
    );
  });

  it('createCheckout falls back to successUrl when successBaseUrl absent', async () => {
    mockService.createCheckoutSession.mockResolvedValue({ checkoutUrl: 'https://pay.example.com' });
    await controller.createCheckout(req, { successUrl: 'https://myapp.com/success' });
    expect(mockService.createCheckoutSession).toHaveBeenCalledWith(
      'user-uuid', 'https://myapp.com/success', expect.any(String),
    );
  });

  it('getCheckout delegates checkoutId', async () => {
    mockService.getCheckoutSession.mockResolvedValue({ session: { status: 'paid' } });
    const result = await controller.getCheckout('checkout-123');
    expect(mockService.getCheckoutSession).toHaveBeenCalledWith('checkout-123');
    expect(result).toEqual({ session: { status: 'paid' } });
  });

  it('cancelCheckout delegates checkoutId', async () => {
    mockService.cancelCheckoutSession.mockResolvedValue({ success: true });
    const result = await controller.cancelCheckout('checkout-123');
    expect(mockService.cancelCheckoutSession).toHaveBeenCalledWith('checkout-123');
    expect(result).toEqual({ success: true });
  });

  it('confirmPurchase defaults missing ids to empty string', async () => {
    mockService.confirmPurchase.mockResolvedValue({ success: true, purchasedCount: 1 });
    await controller.confirmPurchase(req, {});
    expect(mockService.confirmPurchase).toHaveBeenCalledWith('user-uuid', '', '');
  });

  it('confirmPurchase passes provided ids', async () => {
    mockService.confirmPurchase.mockResolvedValue({ success: true, purchasedCount: 2 });
    await controller.confirmPurchase(req, { checkoutId: 'chk-1', referenceId: 'ref-1' });
    expect(mockService.confirmPurchase).toHaveBeenCalledWith('user-uuid', 'chk-1', 'ref-1');
  });

  it('getPurchases delegates req.user.sub', async () => {
    mockService.getPurchases.mockResolvedValue({ purchases: [] });
    const result = await controller.getPurchases(req);
    expect(mockService.getPurchases).toHaveBeenCalledWith('user-uuid');
    expect(result).toEqual({ purchases: [] });
  });

  it('purchaseFromWallet delegates body fields', async () => {
    mockService.purchaseFromWallet.mockResolvedValue({ success: true, purchasedCount: 1, newBalance: 400, walletTransactionRef: 'ref-1' });
    const result = await controller.purchaseFromWallet(req, { campaignIds: ['c1'], quantities: [1] });
    expect(mockService.purchaseFromWallet).toHaveBeenCalledWith('user-uuid', ['c1'], [1]);
    expect(result).toMatchObject({ success: true });
  });
});
