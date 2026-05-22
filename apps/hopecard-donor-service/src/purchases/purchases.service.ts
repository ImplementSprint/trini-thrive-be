import { Injectable, HttpException } from '@nestjs/common';
import { TribeClient } from '@implementsprint/sdk';
import { supabaseRequest, findHopecardRecordByTitle, getRecordId, getRecordTitle } from '@app/common/supabase-helpers';
import { DbPurchase } from '@app/common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { ProcedureEventService } from '@app/api-center';

type HopecardRecord = Record<string, unknown>;

@Injectable()
export class PurchasesService {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly events: ProcedureEventService,
  ) {}

  private getSdkClient() {
    return new TribeClient({
      gatewayUrl: process.env['APICENTER_URL']!,
      tribeId: process.env['APICENTER_TRIBE_ID']!,
      secret: process.env['APICENTER_TRIBE_SECRET']!,
    });
  }

  private async getDonorProfile(buyerAuthId: string): Promise<{
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    payment_customer_id: string | null;
  } | null> {
    const rows = await supabaseRequest<any[]>(
      `digital_donor_profiles?auth_user_id=eq.${buyerAuthId}&select=email,first_name,last_name,phone,payment_customer_id&limit=1`
    ).catch(() => [] as any[]);
    return rows[0] ?? null;
  }

  private async getOrCreatePaymentCustomer(
    buyerAuthId: string,
    profile: { email: string; first_name: string; last_name: string; phone: string; payment_customer_id: string | null },
  ): Promise<string | null> {
    if (profile.payment_customer_id) return profile.payment_customer_id;

    try {
      const customer = await this.getSdkClient().paymentCreateCustomer({
        email: profile.email || undefined,
        phone: profile.phone || undefined,
        name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || undefined,
        metadata: { buyerAuthId },
      });

      await supabaseRequest(`digital_donor_profiles?auth_user_id=eq.${buyerAuthId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ payment_customer_id: customer.customerId }),
      }).catch(() => {});

      return customer.customerId;
    } catch {
      return null;
    }
  }

  private buildReferenceId(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
    return `HC-${datePart}-${suffix}`;
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

  private async finalizePurchases(
    buyerAuthId: string,
    items: Array<{ campaignId: string; title: string; amount: number; quantity: number }>,
    paymentReference: string,
    hopecards: HopecardRecord[],
  ) {
    const purchasesToInsert = items.map((item) => ({
      buyer_auth_id: buyerAuthId,
      hopecard_id: item.campaignId,
      amount_paid: item.amount * item.quantity,
      payment_method: 'paymongo',
      payment_reference: `${paymentReference}-${item.campaignId.slice(0, 8)}`,
      status: 'paid',
      purchased_at: new Date().toISOString(),
    }));

    const inserted = await supabaseRequest<DbPurchase[]>('hopecard_purchases', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(purchasesToInsert),
    });

    // Notify donor
    const totalAmount = items.reduce((sum, i) => sum + i.amount * i.quantity, 0);
    const campaignNames = items.map((i) => i.title).join(', ');
    this.notificationsService.createNotification(
      buyerAuthId,
      'donation_success',
      'Donation Successful!',
      `Your donation of ₱${totalAmount.toLocaleString()} to ${campaignNames} was received. Thank you for your generosity!`,
      { purchase_ids: inserted.map((p) => p.id) },
    ).catch(() => {});

    // Update collected_amount for each campaign
    for (const item of items) {
      const hopecard = hopecards.find((r) => getRecordId(r) === item.campaignId);
      if (hopecard && hopecard._table) {
        const currentAmount = Number(hopecard.collected_amount || 0);
        await supabaseRequest(`${hopecard._table}?id=eq.${item.campaignId}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ collected_amount: currentAmount + item.amount * item.quantity }),
        }).catch(err => console.error(`Failed to update collected_amount for ${item.campaignId}:`, err));
      }
    }

    // Clear cart
    try {
      const cartRes = await supabaseRequest<any[]>(`carts?auth_user_id=eq.${buyerAuthId}&status=eq.active&select=id&limit=1`);
      if (cartRes?.length) {
        const cartId = cartRes[0].id;
        for (const item of items) {
          await supabaseRequest(`cart_items?cart_id=eq.${cartId}&campaign_id=eq.${item.campaignId}`, {
            method: 'DELETE',
            headers: { Prefer: 'return=minimal' },
          }).catch(err => console.error(`Failed to delete cart item ${item.campaignId}:`, err));
        }
      }
    } catch (err) {
      console.error('Failed to clear cart:', err);
    }

    this.events.emit(
      'hopecard.donation.completed',
      {
        buyerAuthId,
        totalAmount: items.reduce((sum, i) => sum + i.amount * i.quantity, 0),
        campaignIds: items.map((i) => i.campaignId),
        referenceId: paymentReference,
        purchaseIds: inserted.map((p) => p.id),
      },
      { partitionKey: buyerAuthId, sourceServiceId: 'hopecard-donor-service' },
    );

    return { purchases: inserted };
  }

  async createCheckoutSession(buyerAuthId: string, checkoutItems: Array<{ cardId: string; title: string; amount: number; quantity: number }>) {
    if (!buyerAuthId) throw new HttpException('buyerAuthId is required.', 400);
    if (!checkoutItems?.length) throw new HttpException('At least one checkout item is required.', 400);

    const subtotal = checkoutItems.reduce((sum, i) => sum + i.amount * i.quantity, 0);
    const processingFee = Math.round(subtotal * 0.015 * 100) / 100;
    const referenceId = this.buildReferenceId();
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3000';

    const lineItems = [
      ...checkoutItems.map(item => ({
        name: item.title,
        quantity: item.quantity,
        amount: { value: Math.round(item.amount * 100), currency: 'PHP' },
      })),
      ...(processingFee > 0 ? [{
        name: 'Processing Fee (1.5%)',
        quantity: 1,
        amount: { value: Math.round(processingFee * 100), currency: 'PHP' },
      }] : []),
    ];

    const donorProfile = await this.getDonorProfile(buyerAuthId);
    const customerId = donorProfile
      ? await this.getOrCreatePaymentCustomer(buyerAuthId, donorProfile)
      : null;

    try {
      const session = await this.getSdkClient().paymentCreateCheckoutSession({
        referenceId,
        successUrl: `${appUrl}/donor/payment/success?ref=${referenceId}&buyerAuthId=${encodeURIComponent(buyerAuthId)}`,
        cancelUrl: `${appUrl}/donor/payment/cancel?ref=${referenceId}`,
        lineItems,
        paymentMethods: ['gcash', 'maya', 'grabpay', 'qrph', 'card'],
        metadata: { buyerAuthId },
        ...(customerId && { customerId }),
        ...(donorProfile && {
          customer: {
            email: donorProfile.email || undefined,
            phone: donorProfile.phone || undefined,
            firstName: donorProfile.first_name || undefined,
            lastName: donorProfile.last_name || undefined,
          },
        }),
      });

      return {
        checkoutId: session.checkoutId,
        checkoutUrl: session.redirectUrl,
        referenceId,
      };
    } catch (err) {
      console.error('[createCheckoutSession] SDK error:', err);
      throw new HttpException('Failed to create payment session.', 502);
    }
  }

  async confirmPurchase(referenceId: string, buyerAuthId: string) {
    if (!referenceId) throw new HttpException('referenceId is required.', 400);
    if (!buyerAuthId) throw new HttpException('buyerAuthId is required.', 400);

    // Verify payment status via SDK
    let session: Awaited<ReturnType<TribeClient['paymentGetCheckoutStatusByReference']>>;
    try {
      session = await this.getSdkClient().paymentGetCheckoutStatusByReference(referenceId);
    } catch (err) {
      console.error('[confirmPurchase] SDK status check error:', err);
      throw new HttpException('Failed to verify payment status.', 502);
    }

    if (session.status !== 'paid') {
      throw new HttpException({ error: 'Payment not completed.', status: session.status }, 402);
    }

    // Idempotency: check if already processed
    const existing = await supabaseRequest<DbPurchase[]>(
      `hopecard_purchases?buyer_auth_id=eq.${encodeURIComponent(buyerAuthId)}&payment_reference=like.${encodeURIComponent(referenceId)}*&limit=1`
    ).catch(() => [] as DbPurchase[]);
    if (existing.length > 0) {
      return { purchases: existing, alreadyProcessed: true };
    }

    // Fetch buyer's active cart items with campaign data
    const cartRes = await supabaseRequest<any[]>(
      `carts?auth_user_id=eq.${buyerAuthId}&status=eq.active&select=id&limit=1`
    );
    if (!cartRes?.length) throw new HttpException('No active cart found for this buyer.', 404);
    const cartId = cartRes[0].id;

    const cartItems = await supabaseRequest<any[]>(
      `cart_items?cart_id=eq.${cartId}&select=campaign_id,face_value,quantity,hc_campaigns(title)`
    );
    if (!cartItems?.length) throw new HttpException('Cart is empty.', 400);

    const hopecards = await this.fetchHopecards();

    const items = cartItems.map((ci) => ({
      campaignId: ci.campaign_id as string,
      title: (ci.hc_campaigns?.title ?? '') as string,
      amount: ci.face_value as number,
      quantity: ci.quantity as number,
    }));

    // Fallback: resolve title from hopecards if join returned nothing
    for (const item of items) {
      if (!item.title) {
        const hopecard = hopecards.find((r) => getRecordId(r) === item.campaignId);
        item.title = hopecard ? (getRecordTitle(hopecard) ?? item.campaignId) : item.campaignId;
      }
    }

    return this.finalizePurchases(buyerAuthId, items, referenceId, hopecards);
  }

  async cancelCheckoutSession(checkoutId: string, reason?: string) {
    if (!checkoutId) throw new HttpException('checkoutId is required.', 400);
    try {
      const session = await this.getSdkClient().paymentMarkCheckoutCancelled(
        checkoutId,
        reason ? { reason } : {},
      );
      return { checkoutId: session.checkoutId, status: session.status };
    } catch (err) {
      console.error('[cancelCheckoutSession] SDK error:', err);
      throw new HttpException('Failed to cancel checkout session.', 502);
    }
  }

  async getCheckoutSession(checkoutId: string) {
    if (!checkoutId) throw new HttpException('checkoutId is required.', 400);
    try {
      const session = await this.getSdkClient().paymentGetCheckoutSession(checkoutId);
      return {
        checkoutId: session.checkoutId,
        status: session.status,
        referenceId: session.referenceId,
        amount: session.amount,
        expiresAt: session.expiresAt,
      };
    } catch (err) {
      console.error('[getCheckoutSession] SDK error:', err);
      throw new HttpException('Failed to retrieve checkout session.', 502);
    }
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
