import { Module } from "@nestjs/common";
import { BeneficiariesService } from "./beneficiaries.service";
import { BeneficiariesController } from "./beneficiaries.controller";
import { CampaignsService } from "./campaigns.service";
import { CampaignsController } from "./campaigns.controller";
import { ActivityLogger } from "@common/activity-logger";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [AnalyticsModule],
  controllers: [BeneficiariesController, CampaignsController],
  providers: [BeneficiariesService, CampaignsService, ActivityLogger],
  exports: [BeneficiariesService, CampaignsService],
})
export class BeneficiariesModule {}
