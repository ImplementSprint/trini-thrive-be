import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { RequirePersona } from '@app/common';

@RequirePersona('donor')
@Controller('hopecard/donor/purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post('checkout')
  createCheckout(
    @Body() body: { authUserId: string; successUrl: string; cancelUrl: string },
  ) {
    return this.purchasesService.createCheckoutSession(body.authUserId, body.successUrl, body.cancelUrl);
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
  confirmPurchase(@Body() body: { authUserId: string; checkoutId: string }) {
    return this.purchasesService.confirmPurchase(body.authUserId, body.checkoutId);
  }

  @Get()
  getPurchases(@Query('authUserId') authUserId: string) {
    return this.purchasesService.getPurchases(authUserId);
  }
}
