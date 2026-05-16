import { Injectable, HttpException } from '@nestjs/common';
import { supabaseRequest, findHopecardRecordByTitle, getRecordId, getRecordTitle } from '@shared/supabase';
import { DbPurchase } from '@shared/types';

type HopecardRecord = Record<string, unknown>;
const PAYMENT_METHOD_MAP: Record<string, string> = { gcash: 'gcash', paymaya: 'maya', 'credit card': 'card' };

@Injectable()
export class PurchasesService {
  private normalizePaymentMethod(method: string): string {
    return PAYMENT_METHOD_MAP[method.trim().toLowerCase()] ?? method.trim().toLowerCase();
  }

  private buildPaymentReference(method: string, index: number): string {
    const prefix = method.slice(0, 3).toUpperCase();
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
    return `${prefix}-HC-${datePart}-${index + 1}-${suffix}`;
  }

  private async fetchHopecards(): Promise<HopecardRecord[]> {
    const results = await Promise.allSettled([
      supabaseRequest<HopecardRecord[]>('hc_campaigns?select=*').then(res => (res || []).map(r => ({ ...r, _table: 'hc_campaigns' }))),
      supabaseRequest<HopecardRecord[]>('hopecards?select=*').then(res => (res || []).map(r => ({ ...r, _table: 'hopecards' }))),
    ]);
    const records: HopecardRecord[] = [];
    results.forEach((r) => { if (r.status === 'fulfilled') records.push(...r.value); });
    if (records.length === 0) throw new Error('No campaign source rows found in hc_campaigns or hopecards.');
    return records;
  }

  async createPurchases(buyerAuthId: string, paymentMethod: string, checkoutItems: { cardId: string; title: string; amount: number; quantity: number }[]) {
    if (!buyerAuthId) throw new HttpException('buyerAuthId is required.', 400);
    if (!paymentMethod) throw new HttpException('paymentMethod is required.', 400);
    if (!checkoutItems?.length) throw new HttpException('At least one checkout item is required.', 400);

    const method = this.normalizePaymentMethod(paymentMethod);
    const hopecards = await this.fetchHopecards();

    const purchasesToInsert = checkoutItems.map((item, index) => {
      const hopecard = findHopecardRecordByTitle(hopecards, item.title);
      const hopecardId = hopecard ? getRecordId(hopecard) : null;
      if (!hopecardId) throw new Error(`No campaign row matched "${item.title}".`);
      return {
        buyer_auth_id: buyerAuthId,
        hopecard_id: hopecardId,
        amount_paid: item.amount * item.quantity,
        payment_method: method,
        payment_reference: this.buildPaymentReference(method, index),
        status: 'paid',
        purchased_at: new Date().toISOString(),
      };
    });

    const inserted = await supabaseRequest<DbPurchase[]>('hopecard_purchases', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(purchasesToInsert),
    });

    // Update collected_amount for each purchased campaign
    for (const item of checkoutItems) {
      const hopecard = findHopecardRecordByTitle(hopecards, item.title);
      const hopecardId = hopecard ? getRecordId(hopecard) : null;
      if (hopecardId && hopecard._table) {
        const currentAmount = Number(hopecard.collected_amount || 0);
        const addAmount = item.amount * item.quantity;
        await supabaseRequest(`${hopecard._table}?id=eq.${hopecardId}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ collected_amount: currentAmount + addAmount }),
        }).catch(err => console.error(`Failed to update collected_amount for ${hopecardId}:`, err));
      }
    }

    // Remove purchased items from basket
    try {
      const cartRes = await supabaseRequest<any[]>(`carts?auth_user_id=eq.${buyerAuthId}&status=eq.active&select=id&limit=1`);
      if (cartRes && cartRes.length > 0) {
        const cartId = cartRes[0].id;
        for (const item of checkoutItems) {
          await supabaseRequest(`cart_items?cart_id=eq.${cartId}&campaign_id=eq.${item.cardId}`, {
            method: 'DELETE',
            headers: { Prefer: 'return=minimal' },
          }).catch(err => console.error(`Failed to delete item ${item.cardId} from cart:`, err));
        }
      }
    } catch (err) {
      console.error('Failed to clear cart items:', err);
    }

    return { purchases: inserted };
  }

  async getPurchases(buyerAuthId: string) {
    if (!buyerAuthId) throw new HttpException('buyerAuthId is required.', 400);
    const purchases = await supabaseRequest<DbPurchase[]>(
      `hopecard_purchases?select=*&buyer_auth_id=eq.${encodeURIComponent(buyerAuthId)}&order=purchased_at.desc`
    );
    const hopecards = await this.fetchHopecards();
    const titleById = new Map<string, string>();
    hopecards.forEach((r) => {
      const id = getRecordId(r);
      const title = getRecordTitle(r);
      if (id && title) titleById.set(id, title);
    });
    const transactions = purchases.map((p) => ({
      id: p.id,
      title: titleById.get(p.hopecard_id) ?? p.hopecard_id,
      amount: p.amount_paid,
      method: p.payment_method,
      status: p.status,
      paymentReference: p.payment_reference,
      purchasedAt: p.purchased_at,
    }));
    return { transactions };
  }
}
