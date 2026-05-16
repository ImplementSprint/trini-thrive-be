import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { BeneficiariesService } from "./beneficiaries.service";
import { BeneficiariesController } from "./beneficiaries.controller";
import { CampaignsService } from "./campaigns.service";
import { CampaignsController } from "./campaigns.controller";
import { ActivityLogger } from "@shared/activity-logger";

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
  controllers: [BeneficiariesController, CampaignsController],
  providers: [BeneficiariesService, CampaignsService, ActivityLogger],
  exports: [BeneficiariesService, CampaignsService],
})
export class BeneficiariesModule {}
