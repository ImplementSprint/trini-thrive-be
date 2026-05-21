import { bootstrapHttpApp } from '@app/common';
import { HopecardAdminServiceModule } from './admin-service.module';

// Use service-specific port env var per the port registry in .env.example
process.env.PORT = process.env.HOPECARD_ADMIN_PORT ?? '3101';

void bootstrapHttpApp({
  module: HopecardAdminServiceModule,
  loggerName: 'HopecardAdminService',
  swaggerTitle: 'Hopecard Admin Service',
  swaggerDescription: 'Hopecard admin backend API',
  defaultPort: 3101,
});
