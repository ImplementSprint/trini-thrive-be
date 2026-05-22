import { bootstrapHttpApp } from '@app/common';
import { DamayanSiteManagerServiceModule } from './site-manager-service.module';

process.env.PORT = process.env.DAMAYAN_SM_PORT ?? '3202';

void bootstrapHttpApp({
  module: DamayanSiteManagerServiceModule,
  loggerName: 'DamayanSiteManagerService',
  swaggerTitle: 'Damayan Site Manager Service',
  swaggerDescription: 'Damayan site manager persona backend API',
  defaultPort: 3202,
});
