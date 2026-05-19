import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { RequirePersona } from '@app/common';

@RequirePersona('donor')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  getPurchases(@Query('buyerAuthId') buyerAuthId: string) {
    return this.purchasesService.getPurchases(buyerAuthId);
  }

  @Post()
  createPurchases(@Body() body: { buyerAuthId: string; paymentMethod: string; checkoutItems: any[] }) {
    return this.purchasesService.createPurchases(body.buyerAuthId, body.paymentMethod, body.checkoutItems);
  }
}
