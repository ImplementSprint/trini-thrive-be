import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { RequirePersona } from '@app/common';

@RequirePersona('donor')
@Controller('hopecard/donor/purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  getPurchases(@Query('buyerAuthId') buyerAuthId: string) {
    return this.purchasesService.getPurchases(buyerAuthId);
  }

  @Post('checkout')
  createCheckoutSession(
    @Body() body: { buyerAuthId: string; checkoutItems: { cardId: string; title: string; amount: number; quantity: number }[] },
  ) {
    return this.purchasesService.createCheckoutSession(body.buyerAuthId, body.checkoutItems);
  }

  @Post('confirm')
  confirmPurchase(@Body() body: { referenceId: string; buyerAuthId: string }) {
    return this.purchasesService.confirmPurchase(body.referenceId, body.buyerAuthId);
  }
}
