jest.mock('jose', () => ({ jwtVerify: jest.fn(), SignJWT: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

const mockService = {
  getCart: jest.fn(),
  addItem: jest.fn(),
  updateItem: jest.fn(),
  removeItem: jest.fn(),
};

describe('CartController', () => {
  let controller: CartController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: mockService }],
    }).compile();
    controller = module.get<CartController>(CartController);
  });

  it('getCart delegates authUserId', async () => {
    mockService.getCart.mockResolvedValue({ cart: { id: 'cart-1', items: [] } });
    const result = await controller.getCart('user-uuid');
    expect(mockService.getCart).toHaveBeenCalledWith('user-uuid');
    expect(result).toMatchObject({ cart: { id: 'cart-1' } });
  });

  it('addItem delegates body fields', async () => {
    mockService.addItem.mockResolvedValue({ cart: { items: [{ id: 'i1' }] } });
    const body = { authUserId: 'user-uuid', campaign_id: 'camp-1', face_value: 500, quantity: 2 };
    const result = await controller.addItem(body);
    expect(mockService.addItem).toHaveBeenCalledWith('user-uuid', 'camp-1', 500, 2);
    expect(result).toMatchObject({ cart: { items: [{ id: 'i1' }] } });
  });

  it('updateItem delegates body fields', async () => {
    mockService.updateItem.mockResolvedValue({ cart: { items: [] } });
    const body = { authUserId: 'user-uuid', cart_item_id: 'item-1', quantity: 3 };
    const result = await controller.updateItem(body);
    expect(mockService.updateItem).toHaveBeenCalledWith('user-uuid', 'item-1', 3);
    expect(result).toMatchObject({ cart: { items: [] } });
  });

  it('removeItem delegates body fields', async () => {
    mockService.removeItem.mockResolvedValue({ cart: { items: [] } });
    const body = { authUserId: 'user-uuid', cart_item_id: 'item-1' };
    const result = await controller.removeItem(body);
    expect(mockService.removeItem).toHaveBeenCalledWith('user-uuid', 'item-1');
    expect(result).toMatchObject({ cart: { items: [] } });
  });
});
