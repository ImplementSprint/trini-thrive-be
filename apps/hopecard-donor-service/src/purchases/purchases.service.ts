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

  async createCheckoutSession(authUserId: string, _successUrl: string, cancelUrl: string) {
    if (!this.client) throw new HttpException('Payment service unavailable', 503);
    if (!UUID_RE.test(authUserId)) throw new HttpException('Invalid authUserId', 400);

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

    // Append ref and buyerAuthId to the frontend-supplied base URL.
    // These params are embedded so the success page can confirm the purchase even when
    // the SameSite=Strict cookie is stripped on the cross-site redirect from PayMongo.
    const separator = _successUrl.includes('?') ? '&' : '?';
    const successUrl = `${_successUrl}${separator}ref=${encodeURIComponent(referenceId)}&buyerAuthId=${encodeURIComponent(authUserId)}`;

    let checkout: unknown;
    try {
      checkout = await this.client.paymentCreateCheckoutSession({
        referenceId,
        idempotencyKey: referenceId,
        successUrl,
        cancelUrl,
        paymentMethods: ['gcash', 'maya', 'grabpay', 'qrph', 'card'],
        lineItems,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpException(`Payment provider error: ${msg}`, 502);
    }

    const session = checkout as import('@implementsprint/sdk').PaymentCheckoutSession;
    return {
      checkoutId: session.checkoutId,
      checkoutUrl: session.redirectUrl,
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

  async confirmPurchase(authUserId: string, checkoutId: string, referenceId?: string) {
    if (!this.client) throw new HttpException('Payment service unavailable', 503);
    if (!UUID_RE.test(authUserId)) throw new HttpException('Invalid authUserId', 400);
    if (!checkoutId && !referenceId) throw new HttpException('checkoutId or referenceId is required', 400);

    let session: import('@implementsprint/sdk').PaymentCheckoutSession;
    try {
      if (checkoutId) {
        session = await this.client.paymentGetCheckoutSession(checkoutId);
      } else {
        session = await this.client.paymentGetCheckoutStatusByReference(referenceId!);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpException(`Payment provider error: ${msg}`, 502);
    }
    const status = String(session.status ?? '').toLowerCase();

    if (!PAID_STATUSES.has(status)) {
      throw new HttpException(`Payment not confirmed (status: ${status || 'unknown'})`, 402);
    }

    let carts: { id: string }[];
    try {
      carts = await supabaseRequest<{ id: string }[]>(
        `carts?auth_user_id=eq.${authUserId}&status=eq.active&limit=1`,
      );
    } catch (err: unknown) {
      throw new HttpException(`DB error fetching cart: ${err instanceof Error ? err.message : String(err)}`, 500);
    }
    const cart = carts[0];
    if (!cart) throw new HttpException('No active cart found', 404);

    let rawItems: { id: string; campaign_id: string; face_value: number; quantity: number }[];
    try {
      rawItems = await supabaseRequest<typeof rawItems>(
        `cart_items?cart_id=eq.${cart.id}&select=id,campaign_id,face_value,quantity`,
      );
    } catch (err: unknown) {
      throw new HttpException(`DB error fetching cart items: ${err instanceof Error ? err.message : String(err)}`, 500);
    }

    // PaymentCheckoutSession doesn't expose the method actually used — default to 'card'
    // which is the most common for test payments and matches the constraint:
    // hopecard_purchases_payment_method_check: gcash | card | bank | maya | bank_transfer
    const paymentMethod = String((session as any).paymentMethod ?? (session as any).payment_method ?? 'card');
    const paymentReference = referenceId || checkoutId;
    const now = new Date().toISOString();

    for (const item of rawItems) {
      for (let i = 0; i < item.quantity; i++) {
        try {
          await supabaseRequest('hopecard_purchases', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              buyer_auth_id: authUserId,
              hopecard_id: item.campaign_id,
              amount_paid: Number(item.face_value),
              payment_method: paymentMethod,
              payment_reference: paymentReference,
              status: 'paid',
              purchased_at: now,
            }),
          });
        } catch (err: unknown) {
          throw new HttpException(`DB error recording purchase: ${err instanceof Error ? err.message : String(err)}`, 500);
        }
      }
    }

    // Clear cart
    try {
      await supabaseRequest(`cart_items?cart_id=eq.${cart.id}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      // Reset the cart to active so the user can make another purchase.
      // The UNIQUE (auth_user_id) constraint means there is exactly one cart row
      // per user — we cannot insert a new one, so we reuse this row.
      await supabaseRequest(`carts?id=eq.${cart.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'active' }),
      });
    } catch (err: unknown) {
      throw new HttpException(`DB error clearing cart: ${err instanceof Error ? err.message : String(err)}`, 500);
    }

    // Update the donor's cumulative donation totals on their profile
    // by summing all paid purchases — this drives the TRAIN Law credit section in the wallet.
    try {
      const allPurchases = await supabaseRequest<{ amount_paid: number }[]>(
        `hopecard_purchases?buyer_auth_id=eq.${authUserId}&status=eq.paid&select=amount_paid`,
      );
      const cumulativeTotal = allPurchases.reduce((sum, p) => sum + Number(p.amount_paid), 0);
      const cumulativeCount = allPurchases.length;

      await supabaseRequest(`digital_donor_profiles?auth_user_id=eq.${authUserId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          total_donations_amount: cumulativeTotal,
          total_donations_count: cumulativeCount,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch {
      // Non-fatal — totals will be recalculated on next profile fetch
    }

    const totalPurchased = rawItems.reduce((sum, i) => sum + i.quantity, 0);
    this.events.emit(
      'hopecard.donation.completed',
      { authUserId, checkoutId, itemCount: rawItems.length, totalPurchased },
      { partitionKey: authUserId, sourceServiceId: 'hopecard-donor-service' },
    );

    const subtotal = rawItems.reduce((sum, i) => sum + Number(i.face_value) * i.quantity, 0);
    const processingFee = Math.round(subtotal * 0.015);
    const totalAmount = subtotal + processingFee;

    return { 
      success: true, 
      purchasedCount: totalPurchased, 
      totalAmount, 
      subtotal, 
      processingFee 
    };
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
