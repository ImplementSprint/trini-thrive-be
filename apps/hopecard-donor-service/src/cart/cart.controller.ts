import { Controller, Get, Post, Patch, Delete, Query, Body } from '@nestjs/common';
import { CartService } from './cart.service';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Query('authUserId') authUserId: string) {
    return this.cartService.getCart(authUserId);
  }

  @Post()
  addItem(@Body() body: { authUserId: string; campaign_id: string; face_value: number; quantity: number }) {
    return this.cartService.addItem(body.authUserId, body.campaign_id, body.face_value, body.quantity);
  }

  @Patch()
  updateItem(@Body() body: { authUserId: string; cart_item_id: string; quantity: number }) {
    return this.cartService.updateItem(body.authUserId, body.cart_item_id, body.quantity);
  }

  @Delete()
  removeItem(@Body() body: { authUserId: string; cart_item_id: string }) {
    return this.cartService.removeItem(body.authUserId, body.cart_item_id);
  }
}
