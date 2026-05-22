import { Module } from '@nestjs/common';
import { BackfillController } from './backfill.controller';
import { DonorPaymentBackfillService } from './donor-payment-backfill.service';

@Module({
  controllers: [BackfillController],
  providers: [DonorPaymentBackfillService],
})
export class BackfillModule {}
