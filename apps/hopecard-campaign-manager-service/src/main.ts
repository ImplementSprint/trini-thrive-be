import { bootstrapHttpApp } from '@app/common';
import { HopecardCampaignManagerServiceModule } from './campaign-manager-service.module';

void bootstrapHttpApp({
  module: HopecardCampaignManagerServiceModule,
  loggerName: 'HopecardCampaignManagerService',
  swaggerTitle: 'Hopecard Campaign Manager Service',
  swaggerDescription: 'Hopecard campaign manager backend API',
  defaultPort: 4022,
});
