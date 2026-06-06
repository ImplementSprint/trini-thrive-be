jest.mock('jose', () => ({ jwtVerify: jest.fn(), SignJWT: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

const mockService = {
  getWalletBalance: jest.fn(),
  initiateTopUp: jest.fn(),
  confirmTopUp: jest.fn(),
  donateFromWallet: jest.fn(),
  getTransactionHistory: jest.fn(),
};
const req = { user: { sub: 'user-uuid' } } as any;

describe('WalletController', () => {
  let controller: WalletController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [{ provide: WalletService, useValue: mockService }],
    }).compile();
    controller = module.get<WalletController>(WalletController);
  });

  it('getBalance delegates req.user.sub', async () => {
    mockService.getWalletBalance.mockResolvedValue({ balance: 500, currency: 'PHP' });
    const result = await controller.getBalance(req);
    expect(mockService.getWalletBalance).toHaveBeenCalledWith('user-uuid');
    expect(result).toEqual({ balance: 500, currency: 'PHP' });
  });

  it('initiateTopUp passes body amount with default URLs', async () => {
    mockService.initiateTopUp.mockResolvedValue({ checkoutUrl: 'https://pay.example.com', referenceId: 'ref-1' });
    const result = await controller.initiateTopUp(req, { amount: 100 });
    expect(mockService.initiateTopUp).toHaveBeenCalledWith(
      'user-uuid', 100,
      'http://localhost:3001/donor/wallet/success',
      'http://localhost:3001/donor/wallet',
    );
    expect(result).toMatchObject({ checkoutUrl: expect.any(String) });
  });

  it('initiateTopUp uses provided URLs when given', async () => {
    mockService.initiateTopUp.mockResolvedValue({ checkoutUrl: 'https://pay.example.com', referenceId: 'ref-2' });
    await controller.initiateTopUp(req, { amount: 200, successUrl: 'https://myapp.com/success', cancelUrl: 'https://myapp.com/cancel' });
    expect(mockService.initiateTopUp).toHaveBeenCalledWith(
      'user-uuid', 200, 'https://myapp.com/success', 'https://myapp.com/cancel',
    );
  });

  it('confirmTopUp delegates body fields', async () => {
    mockService.confirmTopUp.mockResolvedValue({ success: true, newBalance: 600 });
    const result = await controller.confirmTopUp(req, { referenceId: 'wallet-topup-abcd1234-1234567890123', amount: 100 });
    expect(mockService.confirmTopUp).toHaveBeenCalledWith('user-uuid', 'wallet-topup-abcd1234-1234567890123', 100);
    expect(result).toEqual({ success: true, newBalance: 600 });
  });

  it('donateFromWallet delegates body fields', async () => {
    mockService.donateFromWallet.mockResolvedValue({ success: true, newBalance: 400, transactionId: 't1' });
    const result = await controller.donateFromWallet(req, { campaignId: 'camp-1', amount: 100 });
    expect(mockService.donateFromWallet).toHaveBeenCalledWith('user-uuid', 'camp-1', 100);
    expect(result).toMatchObject({ success: true });
  });

  it('getTransactions uses default limit of 50 when not provided', async () => {
    mockService.getTransactionHistory.mockResolvedValue({ transactions: [] });
    await controller.getTransactions(req, undefined);
    expect(mockService.getTransactionHistory).toHaveBeenCalledWith('user-uuid', 50);
  });

  it('getTransactions parses limit from string', async () => {
    mockService.getTransactionHistory.mockResolvedValue({ transactions: [] });
    await controller.getTransactions(req, '20');
    expect(mockService.getTransactionHistory).toHaveBeenCalledWith('user-uuid', 20);
  });
});
