import { Controller, Post, Query } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { DonorPaymentBackfillService } from './donor-payment-backfill.service';

@RequirePersona('admin')
@Controller('hopecard/admin/backfill')
export class BackfillController {
  constructor(private readonly backfill: DonorPaymentBackfillService) {}

  @Post('donor-payment-customers')
  runDonorPaymentBackfill(@Query('dryRun') dryRun?: string) {
    return this.backfill.run(dryRun === 'true');
  }
}
