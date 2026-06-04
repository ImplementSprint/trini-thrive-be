import { Controller, Get, Post, Param, Query, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PurchasesService } from './purchases.service';
import { RequirePersona } from '@app/common';
import type { JwtPayload } from '@app/common';

@RequirePersona('donor', 'hopecard')
@Controller('api/v1/hopecard/donor/purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post('checkout')
  createCheckout(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: { successBaseUrl?: string; successUrl?: string; cancelUrl?: string },
  ) {
    const cancelUrl = body.cancelUrl ?? 'http://localhost:3001/donor/payment/cancel';
    const successBaseUrl = body.successBaseUrl ?? body.successUrl ?? 'http://localhost:3001/donor/payment/success';
    return this.purchasesService.createCheckoutSession(req.user.sub, successBaseUrl, cancelUrl);
  }

  @Get('checkout/:checkoutId')
  getCheckout(@Param('checkoutId') checkoutId: string) {
    return this.purchasesService.getCheckoutSession(checkoutId);
  }

  @Post('checkout/:checkoutId/cancel')
  cancelCheckout(@Param('checkoutId') checkoutId: string) {
    return this.purchasesService.cancelCheckoutSession(checkoutId);
  }

  @Post('confirm')
  confirmPurchase(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: { checkoutId?: string; referenceId?: string },
  ) {
    const checkoutId = body.checkoutId ?? '';
    const referenceId = body.referenceId ?? '';
    return this.purchasesService.confirmPurchase(req.user.sub, checkoutId, referenceId);
  }

  @Get()
  getPurchases(@Req() req: Request & { user: JwtPayload }) {
    return this.purchasesService.getPurchases(req.user.sub);
  }

  @Post('wallet')
  purchaseFromWallet(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    body: {
      campaignIds: string[];
      quantities: number[];
    },
  ) {
    return this.purchasesService.purchaseFromWallet(req.user.sub, body.campaignIds, body.quantities);
  }
}
