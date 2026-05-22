import { Injectable, HttpException, Inject, Optional } from '@nestjs/common';
import { TribeClient } from '@implementsprint/sdk';
import { supabaseRequest } from '@app/common/supabase-helpers';
import { ProcedureEventService } from '@app/api-center';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAID_STATUSES = new Set(['paid', 'succeeded', 'completed', 'active']);

@Injectable()
export class PurchasesService {
  constructor(
    @Optional() @Inject(TribeClient) private readonly client: TribeClient | null,
    private readonly events: ProcedureEventService,
  ) {}

  async createCheckoutSession(authUserId: string, successUrl: string, cancelUrl: string) {
    if (!this.client) throw new HttpException('Payment service unavailable', 503);
    if (!UUID_RE.test(authUserId)) throw new HttpException('Invalid authUserId', 400);
    if (!successUrl || !cancelUrl) throw new HttpException('successUrl and cancelUrl are required', 400);

    const carts = await supabaseRequest<{ id: string }[]>(
      `carts?auth_user_id=eq.${authUserId}&status=eq.active&limit=1`,
    );
    const cart = carts[0];
    if (!cart) throw new HttpException('No active cart found', 404);

    const rawItems = await supabaseRequest<{
      id: string;
      campaign_id: string;
      face_value: number;
      quantity: number;
    }[]>(`cart_items?cart_id=eq.${cart.id}&select=id,campaign_id,face_value,quantity`);

    if (rawItems.length === 0) throw new HttpException('Cart is empty', 400);

    const campaignIds = [...new Set(rawItems.map((i) => i.campaign_id))];
    const campaigns = await supabaseRequest<{ id: string; title: string }[]>(
      `hc_campaigns?id=in.(${campaignIds.join(',')})&select=id,title`,
    );
    const titleById = new Map(campaigns.map((c) => [c.id, c.title]));

    const subtotal = rawItems.reduce((sum, i) => sum + Number(i.face_value) * i.quantity, 0);
    const processingFee = Math.round(subtotal * 0.015);

    // Line items — amounts sent to PayMongo are in centavos (multiply pesos by 100)
    const lineItems: { name: string; quantity: number; amount: { value: number; currency: string } }[] =
      rawItems.map((item) => ({
        name: titleById.get(item.campaign_id) ?? 'Donation',
        quantity: item.quantity,
        amount: { value: Math.round(Number(item.face_value) * 100), currency: 'PHP' },
      }));

    if (processingFee > 0) {
      lineItems.push({
        name: 'Processing Fee (1.5%)',
        quantity: 1,
        amount: { value: processingFee * 100, currency: 'PHP' },
      });
    }

    const referenceId = `hc-${authUserId.slice(0, 8)}-${Date.now()}`;

    const checkout = await this.client.paymentCreateCheckoutSession({
      referenceId,
      successUrl,
      cancelUrl,
      paymentMethods: ['gcash', 'maya', 'grabpay', 'qrph', 'card'],
      lineItems,
    });

    return {
      checkoutId: (checkout as any).checkoutId ?? (checkout as any).id,
      checkoutUrl: (checkout as any).checkoutUrl ?? (checkout as any).url,
      referenceId,
      subtotal,
      processingFee,
      total: subtotal + processingFee,
    };
  }

  async getCheckoutSession(checkoutId: string) {
    if (!this.client) throw new HttpException('Payment service unavailable', 503);
    const session = await this.client.paymentGetCheckoutSession(checkoutId);
    return { session };
  }

  async cancelCheckoutSession(checkoutId: string) {
    if (!this.client) throw new HttpException('Payment service unavailable', 503);
    await this.client.paymentMarkCheckoutCancelled(checkoutId, {
      reason: 'user_cancelled',
    });
    return { success: true };
  }

  async confirmPurchase(authUserId: string, checkoutId: string) {
    if (!this.client) throw new HttpException('Payment service unavailable', 503);
    if (!UUID_RE.test(authUserId)) throw new HttpException('Invalid authUserId', 400);
    if (!checkoutId) throw new HttpException('checkoutId is required', 400);

    const session = await this.client.paymentGetCheckoutSession(checkoutId);
    const status = String((session as any).status ?? (session as any).paymentStatus ?? '').toLowerCase();

    if (!PAID_STATUSES.has(status)) {
      throw new HttpException(`Payment not confirmed (status: ${status || 'unknown'})`, 402);
    }

    const carts = await supabaseRequest<{ id: string }[]>(
      `carts?auth_user_id=eq.${authUserId}&status=eq.active&limit=1`,
    );
    const cart = carts[0];
    if (!cart) throw new HttpException('No active cart found', 404);

    const rawItems = await supabaseRequest<{
      id: string;
      campaign_id: string;
      face_value: number;
      quantity: number;
    }[]>(`cart_items?cart_id=eq.${cart.id}&select=id,campaign_id,face_value,quantity`);

    const paymentMethod =
      String((session as any).paymentMethod ?? (session as any).payment_method ?? 'online');
    const now = new Date().toISOString();

    for (const item of rawItems) {
      for (let i = 0; i < item.quantity; i++) {
        await supabaseRequest('hopecard_purchases', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            buyer_auth_id: authUserId,
            hopecard_id: item.campaign_id,
            amount_paid: Number(item.face_value),
            payment_method: paymentMethod,
            payment_reference: checkoutId,
            status: 'completed',
            purchased_at: now,
          }),
        });
      }
    }

    // Clear cart
    await supabaseRequest(`cart_items?cart_id=eq.${cart.id}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
    await supabaseRequest(`carts?id=eq.${cart.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'completed' }),
    });

    const totalPurchased = rawItems.reduce((sum, i) => sum + i.quantity, 0);
    this.events.emit(
      'hopecard.donation.completed',
      { authUserId, checkoutId, itemCount: rawItems.length, totalPurchased },
      { partitionKey: authUserId, sourceServiceId: 'hopecard-donor-service' },
    );

    return { success: true, purchasedCount: totalPurchased };
  }

  async getPurchases(authUserId: string) {
    if (!UUID_RE.test(authUserId)) throw new HttpException('Invalid authUserId', 400);
    const purchases = await supabaseRequest<{
      id: string;
      hopecard_id: string;
      amount_paid: number;
      payment_method: string;
      payment_reference: string;
      status: string;
      purchased_at: string;
    }[]>(`hopecard_purchases?buyer_auth_id=eq.${authUserId}&order=purchased_at.desc&limit=50`);
    return { purchases };
  }
}
