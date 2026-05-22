import { bootstrapHttpApp } from '@app/common';
import { HopecardCampaignManagerServiceModule } from './campaign-manager-service.module';

process.env.PORT = process.env.HOPECARD_CM_PORT ?? '3103';

void bootstrapHttpApp({
  module: HopecardCampaignManagerServiceModule,
  loggerName: 'HopecardCampaignManagerService',
  swaggerTitle: 'Hopecard Campaign Manager Service',
  swaggerDescription: 'Hopecard campaign manager backend API',
  defaultPort: 3103,
});
