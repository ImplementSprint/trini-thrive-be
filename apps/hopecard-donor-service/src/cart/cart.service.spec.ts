import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ProcedureEventService } from '@app/api-center';
import { CartService } from './cart.service';

const mockSupabaseRequest = jest.fn();
jest.mock('@app/common/supabase-helpers', () => ({
  supabaseRequest: (...args: any[]) => mockSupabaseRequest(...args),
}));
jest.mock('@app/common/storage', () => ({
  getStorageUrl: jest.fn((_b: string, key: string | null) => key ? `https://storage/${key}` : null),
}));
jest.mock('@app/common/types', () => ({}), { virtual: true });

const mockEmit = jest.fn();
const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const CAMP_UUID = '22222222-2222-2222-2222-222222222222';
const ITEM_UUID = '33333333-3333-3333-3333-333333333333';
const CART_UUID = '44444444-4444-4444-4444-444444444444';

describe('CartService', () => {
  let service: CartService;

  beforeEach(async () => {
    mockSupabaseRequest.mockReset();
    mockEmit.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: ProcedureEventService, useValue: { emit: mockEmit } },
      ],
    }).compile();
    service = module.get<CartService>(CartService);
  });

  describe('getCart', () => {
    it('throws 400 for invalid UUID', async () => {
      await expect(service.getCart('bad')).rejects.toMatchObject({ status: 400 });
    });

    it('returns empty cart when no items', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: CART_UUID }]) // upsertActiveCart → existing
        .mockResolvedValueOnce([]); // fetchItemsWithCampaigns → no items
      const result = await service.getCart(VALID_UUID);
      expect(result.cart.items).toHaveLength(0);
      expect(result.cart.subtotal).toBe(0);
    });

    it('creates new cart and returns items', async () => {
      const rawItems = [{ id: ITEM_UUID, cart_id: CART_UUID, campaign_id: CAMP_UUID, face_value: 500, quantity: 2 }];
      const campaigns = [{ id: CAMP_UUID, title: 'Help', category: 'health', cover_image_key: 'img.jpg' }];
      mockSupabaseRequest
        .mockResolvedValueOnce([]) // no existing cart
        .mockResolvedValueOnce([{ id: CART_UUID }]) // create cart
        .mockResolvedValueOnce(rawItems) // fetchItems
        .mockResolvedValueOnce(campaigns); // fetchCampaigns
      const result = await service.getCart(VALID_UUID);
      expect(result.cart.items).toHaveLength(1);
      expect(result.cart.subtotal).toBe(1000);
      expect(result.cart.processing_fee).toBe(15); // 1.5% of 1000
    });
  });

  describe('addItem', () => {
    it('throws 400 for invalid authUserId', async () => {
      await expect(service.addItem('bad', CAMP_UUID, 500, 1)).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 for invalid campaign_id', async () => {
      await expect(service.addItem(VALID_UUID, 'bad', 500, 1)).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when face_value is null', async () => {
      await expect(service.addItem(VALID_UUID, CAMP_UUID, null as any, 1)).rejects.toMatchObject({ status: 400 });
    });

    it('updates quantity for existing cart item', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: CART_UUID }]) // upsert cart
        .mockResolvedValueOnce([{ id: ITEM_UUID, quantity: 1 }]) // existing item
        .mockResolvedValueOnce({}) // patch quantity
        .mockResolvedValueOnce([]) // fetchItems
        .mockResolvedValueOnce([]); // fetchCampaigns
      const result = await service.addItem(VALID_UUID, CAMP_UUID, 500, 2);
      expect(mockEmit).toHaveBeenCalledWith('hopecard.cart.item_added', expect.any(Object), expect.any(Object));
      expect(result.cart).toBeDefined();
    });

    it('inserts new item when not in cart', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: CART_UUID }]) // upsert cart
        .mockResolvedValueOnce([]) // no existing item
        .mockResolvedValueOnce({}) // post new item
        .mockResolvedValueOnce([]) // fetchItems
        .mockResolvedValueOnce([]); // fetchCampaigns
      await service.addItem(VALID_UUID, CAMP_UUID, 500, 1);
      expect(mockEmit).toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    it('throws 400 for invalid authUserId', async () => {
      await expect(service.updateItem('bad', ITEM_UUID, 2)).rejects.toMatchObject({ status: 400 });
    });

    it('deletes item when quantity <= 0', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: CART_UUID }]) // upsert
        .mockResolvedValueOnce({}) // delete
        .mockResolvedValueOnce([]) // fetchItems
        .mockResolvedValueOnce([]); // fetchCampaigns
      const result = await service.updateItem(VALID_UUID, ITEM_UUID, 0);
      expect(mockEmit).toHaveBeenCalledWith('hopecard.cart.item_updated', expect.any(Object), expect.any(Object));
      expect(result.cart).toBeDefined();
    });

    it('patches quantity when > 0', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: CART_UUID }]) // upsert
        .mockResolvedValueOnce({}) // patch
        .mockResolvedValueOnce([]) // fetchItems
        .mockResolvedValueOnce([]); // fetchCampaigns
      await service.updateItem(VALID_UUID, ITEM_UUID, 3);
      expect(mockEmit).toHaveBeenCalled();
    });
  });

  describe('removeItem', () => {
    it('throws 400 for invalid authUserId', async () => {
      await expect(service.removeItem('bad', ITEM_UUID)).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 for invalid cart_item_id', async () => {
      await expect(service.removeItem(VALID_UUID, 'bad')).rejects.toMatchObject({ status: 400 });
    });

    it('deletes item and returns updated cart', async () => {
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: CART_UUID }]) // upsert
        .mockResolvedValueOnce({}) // delete
        .mockResolvedValueOnce([]) // fetchItems
        .mockResolvedValueOnce([]); // fetchCampaigns
      const result = await service.removeItem(VALID_UUID, ITEM_UUID);
      expect(mockEmit).toHaveBeenCalledWith('hopecard.cart.item_removed', expect.any(Object), expect.any(Object));
      expect(result.cart.items).toHaveLength(0);
    });
  });
});
