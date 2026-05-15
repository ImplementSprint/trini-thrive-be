import { Module } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [ActivityController, DashboardController],
  providers: [ActivityService, DashboardService],
})
export class AnalyticsModule {}
