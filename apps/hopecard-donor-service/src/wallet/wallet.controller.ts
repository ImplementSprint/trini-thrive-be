import { Controller, Get, Post, Query, Body, HttpCode, Req } from '@nestjs/common';
import type { Request } from 'express';
import { WalletService } from './wallet.service';
import { RequirePersona } from '@app/common';
import type { JwtPayload } from '@app/common';

@RequirePersona('donor', 'hopecard')
@Controller('api/v1/hopecard/donor/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  getBalance(@Req() req: Request & { user: JwtPayload }) {
    return this.walletService.getWalletBalance(req.user.sub);
  }

  @Post('topup')
  @HttpCode(200)
  initiateTopUp(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    body: {
      amount: number;
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    const successUrl = body.successUrl ?? 'http://localhost:3001/donor/wallet/success';
    const cancelUrl = body.cancelUrl ?? 'http://localhost:3001/donor/wallet';
    return this.walletService.initiateTopUp(req.user.sub, body.amount, successUrl, cancelUrl);
  }

  @Post('topup/confirm')
  @HttpCode(200)
  confirmTopUp(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    body: {
      referenceId: string;
      amount: number;
    },
  ) {
    return this.walletService.confirmTopUp(req.user.sub, body.referenceId, body.amount);
  }

  @Post('donate')
  @HttpCode(200)
  donateFromWallet(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    body: {
      campaignId: string;
      amount: number;
    },
  ) {
    return this.walletService.donateFromWallet(req.user.sub, body.campaignId, body.amount);
  }

  @Get('transactions')
  getTransactions(
    @Req() req: Request & { user: JwtPayload },
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.walletService.getTransactionHistory(req.user.sub, parsedLimit);
  }
}
