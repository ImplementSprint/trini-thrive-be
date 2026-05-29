import { Injectable, HttpException, Inject, Optional } from '@nestjs/common';
import { TribeClient } from '@implementsprint/sdk';
import { supabaseRequest } from '@app/common/supabase-helpers';
import { NotificationsService } from '../notifications/notifications.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAID_STATUSES = new Set(['paid', 'succeeded', 'completed', 'active']);

@Injectable()
export class WalletService {
  constructor(
    @Optional() @Inject(TribeClient) private readonly client: TribeClient | null,
    private readonly notifications: NotificationsService,
  ) {}

  async getWalletBalance(authUserId: string): Promise<{ balance: number; currency: string }> {
    if (!authUserId) throw new HttpException('authUserId is required', 400);
    if (!UUID_RE.test(authUserId)) throw new HttpException('authUserId must be a valid UUID', 400);

    try {
      const wallets = await supabaseRequest<{ wallet_balance: number; currency: string }[]>(
        `user_wallets?user_id=eq.${authUserId}&select=wallet_balance,currency`,
      );

      if (wallets.length === 0) {
        // Initialize wallet for new user
        await supabaseRequest('user_wallets', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            user_id: authUserId,
            wallet_balance: 0,
            currency: 'PHP',
          }),
        });
        return { balance: 0, currency: 'PHP' };
      }

      const wallet = wallets[0];
      return {
        balance: Number(wallet.wallet_balance),
        currency: wallet.currency,
      };
    } catch (err: unknown) {
      throw new HttpException(
        `DB error fetching wallet: ${err instanceof Error ? err.message : String(err)}`,
        500,
      );
    }
  }

  async initiateTopUp(
    authUserId: string,
    amount: number,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ checkoutUrl: string; referenceId: string }> {
    if (!authUserId) throw new HttpException('authUserId is required', 400);
    if (!UUID_RE.test(authUserId)) throw new HttpException('authUserId must be a valid UUID', 400);
    if (!amount || amount < 50) throw new HttpException('Minimum top-up is ₱50', 400);

    const referenceId = `wallet-topup-${authUserId.slice(0, 8)}-${Date.now()}`;

    // Format amounts for PayMongo (in centavos)
    const amountInCentavos = Math.round(amount * 100);

    if (!this.client) {
      if (process.env.NODE_ENV !== 'production') {
        const mockSuccessUrl = `${successUrl}?amount=${encodeURIComponent(amount)}&ref=${encodeURIComponent(referenceId)}`;
        return {
          checkoutUrl: mockSuccessUrl,
          referenceId,
        };
      }
      throw new HttpException('Payment service unavailable', 503);
    }

    try {
      const checkout = await this.client.paymentCreateCheckoutSession({
        referenceId,
        idempotencyKey: referenceId,
        successUrl: `${successUrl}?amount=${encodeURIComponent(amount)}&ref=${encodeURIComponent(referenceId)}`,
        cancelUrl,
        paymentMethods: ['gcash', 'maya', 'grabpay', 'qrph', 'card'],
        lineItems: [
          {
            name: 'HopeCard Wallet Top-Up',
            quantity: 1,
            amount: { value: amountInCentavos, currency: 'PHP' },
          },
        ],
      });

      const session = checkout as import('@implementsprint/sdk').PaymentCheckoutSession;
      return {
        checkoutUrl: session.redirectUrl,
        referenceId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpException(`Payment provider error: ${msg}`, 502);
    }
  }

  async confirmTopUp(
    authUserId: string,
    referenceId: string,
    amount: number,
  ): Promise<{ success: boolean; newBalance: number }> {
    if (!authUserId) throw new HttpException('authUserId is required', 400);
    if (!UUID_RE.test(authUserId)) throw new HttpException('authUserId must be a valid UUID', 400);
    if (!referenceId) throw new HttpException('referenceId is required', 400);
    if (!amount || amount < 50) throw new HttpException('Invalid amount', 400);

    // [IDOR + injection] Validate full referenceId shape before any DB interpolation.
    // Format produced by initiateTopUp: wallet-topup-<8 hex chars>-<13-digit epoch ms>
    const REF_RE = /^wallet-topup-[0-9a-f]{8}-\d{10,16}$/;
    if (!REF_RE.test(referenceId)) {
      throw new HttpException('Invalid referenceId format', 400);
    }
    const expectedPrefix = `wallet-topup-${authUserId.slice(0, 8)}-`;
    if (!referenceId.startsWith(expectedPrefix)) {
      throw new HttpException('referenceId does not belong to this user', 403);
    }

    let session: any;
    let isMock = false;

    if (!this.client) {
      if (process.env.NODE_ENV !== 'production') {
        session = { status: 'paid', paymentMethod: 'mock_card' };
        isMock = true;
      } else {
        throw new HttpException('Payment service unavailable', 503);
      }
    } else {
      try {
        session = await this.client.paymentGetCheckoutStatusByReference(referenceId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new HttpException(`Payment provider error: ${msg}`, 502);
      }
    }

    const status = String(session.status ?? '').toLowerCase();
    if (!PAID_STATUSES.has(status)) {
      throw new HttpException(`Payment not confirmed (status: ${status || 'unknown'})`, 402);
    }

    // [Amount] Use the authoritative amount from the payment session; fall back to
    // client-provided only in mock/dev where no real session exists.
    const sessionAmountCentavos =
      session?.lineItems?.[0]?.amount?.value ?? session?.amountPaid ?? null;
    const creditAmount = !isMock && sessionAmountCentavos != null
      ? sessionAmountCentavos / 100
      : amount;

    const now = new Date().toISOString();
    const paymentMethod = String((session as any).paymentMethod ?? 'card');

    try {
      // [Replay] Reject if this referenceId was already credited
      const existing = await supabaseRequest<{ id: string }[]>(
        `wallet_transactions?reference_id=eq.${encodeURIComponent(referenceId)}&type=eq.topup&status=eq.completed&select=id`,
      );
      if (existing.length > 0) {
        const wallets = await supabaseRequest<{ wallet_balance: number }[]>(
          `user_wallets?user_id=eq.${authUserId}&select=wallet_balance`,
        );
        return { success: true, newBalance: Number(wallets[0]?.wallet_balance ?? 0) };
      }

      const wallets = await supabaseRequest<{ id: string; wallet_balance: number }[]>(
        `user_wallets?user_id=eq.${authUserId}&select=id,wallet_balance`,
      );

      if (wallets.length === 0) {
        throw new HttpException('Wallet not found', 404);
      }

      const wallet = wallets[0];
      const newBalance = Number(wallet.wallet_balance) + creditAmount;

      await supabaseRequest('wallet_transactions', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: authUserId,
          wallet_id: wallet.id,
          type: 'topup',
          amount: creditAmount,
          status: 'completed',
          reference_id: referenceId,
          description: `Top-up via ${paymentMethod}`,
          metadata: { payment_method: paymentMethod },
          completed_at: now,
        }),
      });

      await supabaseRequest(`user_wallets?id=eq.${wallet.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          wallet_balance: newBalance,
          updated_at: now,
        }),
      });

      // Fire topup_success notification (non-fatal)
      this.notifications.createNotification(
        authUserId,
        'topup_success',
        'Wallet Top-Up Successful',
        `₱${creditAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been added to your wallet.`,
        { amount: creditAmount, reference_id: referenceId, new_balance: newBalance },
      ).catch(() => {});

      return { success: true, newBalance };
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        `DB error processing top-up: ${err instanceof Error ? err.message : String(err)}`,
        500,
      );
    }
  }

  async donateFromWallet(
    authUserId: string,
    campaignId: string,
    amount: number,
  ): Promise<{ success: boolean; newBalance: number; transactionId: string }> {
    if (!authUserId) throw new HttpException('authUserId is required', 400);
    if (!UUID_RE.test(authUserId)) throw new HttpException('authUserId must be a valid UUID', 400);
    if (!campaignId) throw new HttpException('campaignId is required', 400);
    if (!amount || amount <= 0) throw new HttpException('Invalid amount', 400);

    try {
      // Get wallet
      const wallets = await supabaseRequest<{ id: string; wallet_balance: number }[]>(
        `user_wallets?user_id=eq.${authUserId}&select=id,wallet_balance`,
      );

      if (wallets.length === 0) {
        throw new HttpException('Wallet not found', 404);
      }

      const wallet = wallets[0];
      const currentBalance = Number(wallet.wallet_balance);

      if (currentBalance < amount) {
        throw new HttpException('Insufficient wallet balance', 402);
      }

      const newBalance = currentBalance - amount;
      const now = new Date().toISOString();

      // Create transaction record
      const transactions = await supabaseRequest<{ id: string }[]>('wallet_transactions', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          user_id: authUserId,
          wallet_id: wallet.id,
          type: 'donation',
          amount,
          status: 'completed',
          description: `Donation to campaign ${campaignId}`,
          metadata: { campaign_id: campaignId },
          completed_at: now,
        }),
      });

      if (!transactions || transactions.length === 0) {
        throw new HttpException('Failed to create transaction record', 500);
      }

      const transactionId = transactions[0].id;

      // Update wallet balance
      await supabaseRequest(`user_wallets?id=eq.${wallet.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          wallet_balance: newBalance,
          updated_at: now,
        }),
      });

      return { success: true, newBalance, transactionId };
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        `DB error processing donation: ${err instanceof Error ? err.message : String(err)}`,
        500,
      );
    }
  }

  async getTransactionHistory(
    authUserId: string,
    limit: number = 50,
  ): Promise<{
    transactions: Array<{
      id: string;
      type: string;
      amount: number;
      status: string;
      description: string;
      created_at: string;
    }>;
  }> {
    if (!authUserId) throw new HttpException('authUserId is required', 400);
    if (!UUID_RE.test(authUserId)) throw new HttpException('authUserId must be a valid UUID', 400);

    try {
      const transactions = await supabaseRequest<
        Array<{
          id: string;
          type: string;
          amount: number;
          status: string;
          description: string;
          created_at: string;
        }>
      >(
        `wallet_transactions?user_id=eq.${authUserId}&order=created_at.desc&limit=${limit}&select=id,type,amount,status,description,created_at`,
      );

      return { transactions };
    } catch (err: unknown) {
      throw new HttpException(
        `DB error fetching transactions: ${err instanceof Error ? err.message : String(err)}`,
        500,
      );
    }
  }
}
