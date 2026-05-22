import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { ProcedureEventService } from '@app/api-center';

function generateWdRef(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `WD-${ts}-${rand}`;
}

@Injectable()
export class WithdrawalsService {
  constructor(private readonly events: ProcedureEventService) {}

  private get admin() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  async requestWithdrawal(
    authUserId: string,
    body: { amount: number; bank_account_id?: string; notes?: string },
  ) {
    const { amount, bank_account_id, notes } = body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    const [{ data: profile }, { data: beneficiary }] = await Promise.all([
      this.admin.from('beneficiary_profiles').select('id').eq('auth_user_id', authUserId).single(),
      this.admin.from('beneficiaries').select('id').eq('auth_user_id', authUserId).single(),
    ]);

    if (!beneficiary || !profile) throw new NotFoundException('Beneficiary not found');

    const [{ data: txRows }, { data: wdRows }] = await Promise.all([
      this.admin
        .from('beneficiary_transactions')
        .select('amount')
        .eq('beneficiary_id', beneficiary.id)
        .eq('status', 'approved'),
      this.admin
        .from('beneficiary_withdrawals')
        .select('amount')
        .eq('beneficiary_id', beneficiary.id)
        .eq('status', 'approved'),
    ]);

    const totalReceived = (txRows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
    const totalWithdrawn = (wdRows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
    const available = totalReceived - totalWithdrawn;

    if (amount > available) {
      throw new BadRequestException(
        `Insufficient balance. Available: ₱${available.toLocaleString('en-PH')}`,
      );
    }

    const referenceNumber = generateWdRef();

    const { data: withdrawal, error } = await this.admin
      .from('beneficiary_withdrawals')
      .insert({
        beneficiary_id: beneficiary.id,
        bank_account_id: bank_account_id ?? null,
        reference_number: referenceNumber,
        amount,
        status: 'pending',
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    this.events.emit(
      'hopecard.withdrawal.requested',
      { beneficiaryId: beneficiary.id, authUserId, amount, referenceNumber, bankAccountId: bank_account_id ?? null },
      { partitionKey: beneficiary.id, sourceServiceId: 'hopecard-beneficiary-service' },
    );

    await this.admin.from('beneficiary_banking_activity').insert({
      beneficiary_profile_id: profile.id,
      bank_account_id: bank_account_id ?? null,
      event_type: 'withdrawal_requested',
      status: 'pending',
      details: `Withdrawal of ₱${amount.toLocaleString('en-PH')} requested. Ref: ${referenceNumber}`,
    });

    return { withdrawal };
  }

  async getWithdrawals(authUserId: string) {
    const { data: beneficiary } = await this.admin
      .from('beneficiaries')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();
    if (!beneficiary) throw new NotFoundException('Beneficiary not found');

    const { data, error } = await this.admin
      .from('beneficiary_withdrawals')
      .select('*')
      .eq('beneficiary_id', beneficiary.id)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return { withdrawals: data ?? [] };
  }
}
