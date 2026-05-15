import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BeneficiaryApprovalsService } from './beneficiary-approvals.service';
import { BeneficiaryApprovalsController } from './beneficiary-approvals.controller';
import { CampaignManagerApprovalsService } from './campaign-manager-approvals.service';
import { CampaignManagerApprovalsController } from './campaign-manager-approvals.controller';
import { DigitalDonorApprovalsService } from './digital-donor-approvals.service';
import { DigitalDonorApprovalsController } from './digital-donor-approvals.controller';
import { ActivityLogger } from '@shared/activity-logger';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ANALYTICS_SERVICE',
        transport: Transport.TCP,
        options: {
          host: 'localhost',
          port: 5004,
        },
      },
    ]),
  ],
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
