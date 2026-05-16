import { Injectable, HttpException } from '@nestjs/common';
import { supabaseRequest } from '@shared/supabase';
import { getStorageUrl } from '@shared/storage';
import { DbCart, DbCartItem } from '@shared/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID_RE.test(v);
}

@Injectable()
export class CartService {
  private async upsertActiveCart(authUserId: string): Promise<string> {
    const existing = await supabaseRequest<DbCart[]>(`carts?auth_user_id=eq.${authUserId}&status=eq.active&limit=1`);
    if (existing.length > 0) return existing[0].id;
    const created = await supabaseRequest<DbCart[]>('carts', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ auth_user_id: authUserId, status: 'active' }),
    });
    return created[0].id;
  }

  private formatCart(cartId: string, items: DbCartItem[]) {
    const mappedItems = items.map((item) => ({
      id: item.id,
      campaign_id: item.campaign_id,
      title: item.hc_campaigns?.title ?? 'Campaign',
      category: item.hc_campaigns?.category ?? 'other',
      cover_image_url: getStorageUrl('campaigns', item.hc_campaigns?.cover_image_key ?? null),
      face_value: Number(item.face_value),
      quantity: item.quantity,
    }));
    const subtotal = mappedItems.reduce((sum, i) => sum + i.face_value * i.quantity, 0);
    const processing_fee = Math.round(subtotal * 0.015);
    return { cart: { id: cartId, items: mappedItems, subtotal, processing_fee, total: subtotal + processing_fee } };
  }

  private async fetchItemsWithCampaigns(cartId: string): Promise<DbCartItem[]> {
    type RawItem = Omit<DbCartItem, 'hc_campaigns'>;
    type Campaign = { id: string; title: string; category: string | null; cover_image_key: string | null };

    const raw = await supabaseRequest<RawItem[]>(
      `cart_items?cart_id=eq.${cartId}&select=id,cart_id,campaign_id,face_value,quantity`
    );
    if (raw.length === 0) return [];

    const ids = [...new Set(raw.map((i) => i.campaign_id))];
    const campaigns = await supabaseRequest<Campaign[]>(
      `hc_campaigns?id=in.(${ids.join(',')})&select=id,title,category,cover_image_key`
    );
    const byId = new Map(campaigns.map((c) => [c.id, c]));

    return raw.map((item) => {
      const c = byId.get(item.campaign_id) ?? null;
      return { ...item, hc_campaigns: c ? { title: c.title, category: c.category, cover_image_key: c.cover_image_key } : null };
    });
  }

  async getCart(authUserId: string) {
    if (!isUuid(authUserId)) throw new HttpException('Invalid authUserId', 400);
    const cartId = await this.upsertActiveCart(authUserId);
    return this.formatCart(cartId, await this.fetchItemsWithCampaigns(cartId));
  }

  async addItem(authUserId: string, campaign_id: string, face_value: number, quantity: number) {
    if (!isUuid(authUserId) || !isUuid(campaign_id) || face_value == null) {
      throw new HttpException('authUserId, campaign_id, face_value required', 400);
    }
    const cartId = await this.upsertActiveCart(authUserId);
    const existing = await supabaseRequest<{ id: string; quantity: number }[]>(
      `cart_items?cart_id=eq.${cartId}&campaign_id=eq.${campaign_id}&limit=1`
    );
    if (existing.length > 0) {
      await supabaseRequest(`cart_items?id=eq.${existing[0].id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ quantity: existing[0].quantity + (quantity ?? 1) }),
      });
    } else {
      await supabaseRequest('cart_items', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ cart_id: cartId, campaign_id, face_value, quantity: quantity ?? 1 }),
      });
    }
    return this.formatCart(cartId, await this.fetchItemsWithCampaigns(cartId));
  }

  async updateItem(authUserId: string, cart_item_id: string, quantity: number) {
    if (!isUuid(authUserId) || !isUuid(cart_item_id) || quantity === undefined) {
      throw new HttpException('authUserId, cart_item_id, quantity required', 400);
    }
    const cartId = await this.upsertActiveCart(authUserId);
    if (quantity <= 0) {
      await supabaseRequest(`cart_items?id=eq.${cart_item_id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    } else {
      await supabaseRequest(`cart_items?id=eq.${cart_item_id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ quantity }),
      });
    }
    return this.formatCart(cartId, await this.fetchItemsWithCampaigns(cartId));
  }

  async removeItem(authUserId: string, cart_item_id: string) {
    if (!isUuid(authUserId) || !isUuid(cart_item_id)) {
      throw new HttpException('authUserId, cart_item_id required', 400);
    }
    const cartId = await this.upsertActiveCart(authUserId);
    await supabaseRequest(`cart_items?id=eq.${cart_item_id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    return this.formatCart(cartId, await this.fetchItemsWithCampaigns(cartId));
  }
}
