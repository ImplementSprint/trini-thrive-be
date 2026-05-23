import { Controller, Get, Post, Param, Query, Body, Req } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { RequirePersona } from '@app/common';

@RequirePersona('donor', 'hopecard')
@Controller('hopecard/donor/purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post('checkout')
  createCheckout(
    @Req() req: any,
    @Body() body: { authUserId?: string; buyerAuthId?: string; successBaseUrl?: string; successUrl?: string; cancelUrl?: string },
  ) {
    const authUserId = body.authUserId ?? body.buyerAuthId ?? req.user?.sub ?? '';
    const cancelUrl = body.cancelUrl ?? 'http://localhost:3001/donor/payment/cancel';
    const successBaseUrl = body.successBaseUrl ?? body.successUrl ?? 'http://localhost:3001/donor/payment/success';
    return this.purchasesService.createCheckoutSession(authUserId, successBaseUrl, cancelUrl);
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
  confirmPurchase(@Req() req: any, @Body() body: { authUserId?: string; buyerAuthId?: string; checkoutId?: string; referenceId?: string }) {
    const authUserId = body.authUserId ?? body.buyerAuthId ?? req.user?.sub ?? '';
    const checkoutId = body.checkoutId ?? '';
    const referenceId = body.referenceId ?? '';
    return this.purchasesService.confirmPurchase(authUserId, checkoutId, referenceId);
  }

  @Get()
  getPurchases(@Req() req: any, @Query('authUserId') authUserId?: string) {
    const userId = authUserId || req.user?.sub;
    return this.purchasesService.getPurchases(userId);
  }
}
