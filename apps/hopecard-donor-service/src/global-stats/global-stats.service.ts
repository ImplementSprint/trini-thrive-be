import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class GlobalStatsService {
  private get admin() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  async getStats() {
    const [purchasesResult, beneficiariesResult] = await Promise.all([
      // Total amount from all purchases ever (all statuses counted as paid)
      this.admin
        .from('hopecard_purchases')
        .select('amount_paid')
        .eq('status', 'paid'),
      // Count of all beneficiary accounts
      this.admin
        .from('beneficiary_profiles')
        .select('id', { count: 'exact', head: true }),
    ]);

    const fundsRaised = (purchasesResult.data ?? []).reduce(
      (sum, row) => sum + (Number(row.amount_paid) || 0),
      0,
    );
    const livesImpacted = Math.floor(fundsRaised / 200);
    const globalPartners = beneficiariesResult.count ?? 0;

    return { livesImpacted, fundsRaised, globalPartners };
  }
}
