import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { ProcedureEventService } from '@app/api-center';

type SbError = { message: string; code?: string } | null;

interface ProfileRow {
  id: string;
}

interface BankAccountRow {
  id: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  is_primary: boolean;
  status: string;
}

@Injectable()
export class BankAccountsService {
  constructor(private readonly events: ProcedureEventService) {}
  private get admin() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  private async getProfile(authUserId: string) {
    const { data, error } = (await this.admin
      .from('beneficiary_profiles')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single()) as { data: ProfileRow | null; error: SbError };
    if (error || !data)
      throw new NotFoundException('Beneficiary profile not found');
    return data;
  }

  async getAccounts(authUserId: string) {
    const profile = await this.getProfile(authUserId);
    const { data, error } = (await this.admin
      .from('beneficiary_bank_accounts')
      .select(
        'id, bank_name, account_holder_name, account_number, is_primary, status',
      )
      .eq('beneficiary_profile_id', profile.id)
      .eq('is_active', true)
      .eq('status', 'approved')
      .order('is_primary', { ascending: false })) as {
      data: BankAccountRow[] | null;
      error: SbError;
    };
    if (error) throw new BadRequestException(error.message);
    return { accounts: data ?? [] };
  }

  async createAccount(
    authUserId: string,
    body: {
      bank_name: string;
      account_holder_name: string;
      account_number: string;
    },
  ) {
    const { bank_name, account_holder_name, account_number } = body;
    if (!bank_name || !account_holder_name || !account_number) {
      throw new BadRequestException('Missing required fields');
    }
    const profile = await this.getProfile(authUserId);

    const { count } = await this.admin
      .from('beneficiary_bank_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('beneficiary_profile_id', profile.id)
      .eq('is_active', true);

    const { data: newAccount, error } = (await this.admin
      .from('beneficiary_bank_accounts')
      .insert({
        beneficiary_profile_id: profile.id,
        bank_name,
        account_holder_name,
        account_number,
        is_primary: (count ?? 0) === 0,
        is_active: true,
      })
      .select()
      .single()) as { data: BankAccountRow | null; error: SbError };

    if (error) throw new BadRequestException(error.message);

    void (await this.admin.from('beneficiary_banking_activity').insert({
      beneficiary_profile_id: profile.id,
      bank_account_id: newAccount!.id,
      event_type: 'account_added',
      status: 'completed',
      details: `${bank_name} account ending in ${String(account_number).slice(-4)} added.`,
    }));

    this.events.emit(
      'hopecard.bank_account.submitted',
      {
        authUserId,
        beneficiaryProfileId: profile.id,
        accountId: newAccount!.id,
        bankName: bank_name,
      },
      {
        partitionKey: profile.id,
        sourceServiceId: 'hopecard-beneficiary-service',
      },
    );

    return { account: newAccount };
  }

  async updateAccount(
    authUserId: string,
    accountId: string,
    body: Partial<{
      bank_name: string;
      account_holder_name: string;
      account_number: string;
      is_primary: boolean;
    }>,
  ) {
    const profile = await this.getProfile(authUserId);
    const { data, error } = (await this.admin
      .from('beneficiary_bank_accounts')
      .update(body)
      .eq('id', accountId)
      .eq('beneficiary_profile_id', profile.id)
      .select()
      .single()) as { data: BankAccountRow | null; error: SbError };
    if (error) throw new BadRequestException(error.message);
    this.events.emit(
      'hopecard.bank_account.updated',
      {
        authUserId,
        beneficiaryProfileId: profile.id,
        accountId,
        updates: body,
      },
      {
        partitionKey: profile.id,
        sourceServiceId: 'hopecard-beneficiary-service',
      },
    );
    return { account: data };
  }

  async deleteAccount(authUserId: string, accountId: string) {
    const profile = await this.getProfile(authUserId);
    const { error } = (await this.admin
      .from('beneficiary_bank_accounts')
      .update({ is_active: false })
      .eq('id', accountId)
      .eq('beneficiary_profile_id', profile.id)) as { error: SbError };
    if (error) throw new BadRequestException(error.message);
    this.events.emit(
      'hopecard.bank_account.deleted',
      { authUserId, beneficiaryProfileId: profile.id, accountId },
      {
        partitionKey: profile.id,
        sourceServiceId: 'hopecard-beneficiary-service',
      },
    );
    return { success: true };
  }
}
