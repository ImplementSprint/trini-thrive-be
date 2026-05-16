import { Module } from '@nestjs/common';
import { BeneficiaryApprovalsService } from './beneficiary-approvals.service';
import { BeneficiaryApprovalsController } from './beneficiary-approvals.controller';
import { CampaignManagerApprovalsService } from './campaign-manager-approvals.service';
import { CampaignManagerApprovalsController } from './campaign-manager-approvals.controller';
import { DigitalDonorApprovalsService } from './digital-donor-approvals.service';
import { DigitalDonorApprovalsController } from './digital-donor-approvals.controller';
import { ActivityLogger } from '@app/common/activity-logger';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  providers: [
    BeneficiaryApprovalsService,
    CampaignManagerApprovalsService,
    DigitalDonorApprovalsService,
    ActivityLogger,
  ],
  controllers: [
    BeneficiaryApprovalsController,
    CampaignManagerApprovalsController,
    DigitalDonorApprovalsController,
  ],
  exports: [
    BeneficiaryApprovalsService,
    CampaignManagerApprovalsService,
    DigitalDonorApprovalsService,
  ],
})
export class ApprovalsModule {}
