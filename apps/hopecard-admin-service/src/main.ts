import { bootstrapHttpApp } from '@app/common';
import { HopecardAdminServiceModule } from './admin-service.module';

void bootstrapHttpApp({
  module: HopecardAdminServiceModule,
  loggerName: 'HopecardAdminService',
  swaggerTitle: 'Hopecard Admin Service',
  swaggerDescription: 'Hopecard admin backend API',
  defaultPort: 4020,
});
