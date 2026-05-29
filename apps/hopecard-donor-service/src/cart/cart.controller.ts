import { Controller, Get, Post, Patch, Delete, Query, Body, Param, Req } from '@nestjs/common';
import { CartService } from './cart.service';
import { RequirePersona } from '@app/common';

@RequirePersona('donor', 'hopecard')
@Controller('hopecard/donor/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() req: any, @Query('authUserId') authUserId: string) {
    const userId = authUserId || req.user?.sub;
    return this.cartService.getCart(userId);
  }

  @Post(['', 'items'])
  addItem(
    @Req() req: any,
    @Body() body: { authUserId?: string; campaign_id: string; face_value: number; quantity: number },
    @Query('authUserId') authUserIdQuery?: string
  ) {
    const userId = body?.authUserId || authUserIdQuery || req.user?.sub || '';
    return this.cartService.addItem(userId, body.campaign_id, body.face_value, body.quantity);
  }

  @Patch(['', 'items/:cart_item_id'])
  updateItem(
    @Req() req: any,
    @Body() body: { authUserId?: string; cart_item_id?: string; quantity: number },
    @Query('authUserId') authUserIdQuery?: string,
    @Param('cart_item_id') cartItemIdParam?: string
  ) {
    const userId = body?.authUserId || authUserIdQuery || req.user?.sub || '';
    const cartItemId = cartItemIdParam || body?.cart_item_id || '';
    return this.cartService.updateItem(userId, cartItemId, body.quantity);
  }

  @Delete(['', 'items/:cart_item_id'])
  removeItem(
    @Req() req: any,
    @Body() body: { authUserId?: string; cart_item_id?: string },
    @Query('authUserId') authUserIdQuery?: string,
    @Param('cart_item_id') cartItemIdParam?: string
  ) {
    const userId = body?.authUserId || authUserIdQuery || req.user?.sub || '';
    const cartItemId = cartItemIdParam || body?.cart_item_id || '';
    return this.cartService.removeItem(userId, cartItemId);
  }

  @Delete('clear')
  clearCart(@Req() req: any, @Query('authUserId') authUserIdQuery?: string) {
    const userId = authUserIdQuery || req.user?.sub || '';
    return this.cartService.clearCart(userId);
  }
}
