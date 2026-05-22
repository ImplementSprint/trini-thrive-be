import { Module } from '@nestjs/common';
import { BeneficiaryNotificationsController } from './notifications.controller';
import { BeneficiaryNotificationsService } from './notifications.service';

@Module({
  controllers: [BeneficiaryNotificationsController],
  providers: [BeneficiaryNotificationsService],
})
export class BeneficiaryNotificationsModule {}
