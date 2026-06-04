import { Controller, Get, Post, Query, Body, HttpCode } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { RequirePersona } from '@app/common';

@RequirePersona('donor', 'hopecard')
@Controller('api/v1/hopecard/donor/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  getBalance(@Query('authUserId') authUserId: string) {
    return this.walletService.getWalletBalance(authUserId);
  }

  @Post('topup')
  @HttpCode(200)
  initiateTopUp(
    @Body()
    body: {
      authUserId?: string;
      buyerAuthId?: string;
      amount: number;
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    const authUserId = body.authUserId ?? body.buyerAuthId ?? '';
    const successUrl = body.successUrl ?? 'http://localhost:3001/donor/wallet/success';
    const cancelUrl = body.cancelUrl ?? 'http://localhost:3001/donor/wallet';
    return this.walletService.initiateTopUp(authUserId, body.amount, successUrl, cancelUrl);
  }

  @Post('topup/confirm')
  @HttpCode(200)
  confirmTopUp(
    @Body()
    body: {
      authUserId?: string;
      buyerAuthId?: string;
      referenceId: string;
      amount: number;
    },
  ) {
    const authUserId = body.authUserId ?? body.buyerAuthId ?? '';
    return this.walletService.confirmTopUp(authUserId, body.referenceId, body.amount);
  }

  @Post('donate')
  @HttpCode(200)
  donateFromWallet(
    @Body()
    body: {
      authUserId?: string;
      buyerAuthId?: string;
      campaignId: string;
      amount: number;
    },
  ) {
    const authUserId = body.authUserId ?? body.buyerAuthId ?? '';
    return this.walletService.donateFromWallet(authUserId, body.campaignId, body.amount);
  }

  @Get('transactions')
  getTransactions(
    @Query('authUserId') authUserId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.walletService.getTransactionHistory(authUserId, parsedLimit);
  }
}
