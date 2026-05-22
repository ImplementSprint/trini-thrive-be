import { bootstrapHttpApp } from '@app/common';
import { DamayanAdminServiceModule } from './admin-service.module';

process.env.PORT = process.env.DAMAYAN_ADMIN_PORT ?? '3201';

void bootstrapHttpApp({
  module: DamayanAdminServiceModule,
  loggerName: 'DamayanAdminService',
  swaggerTitle: 'Damayan Admin Service',
  swaggerDescription: 'Damayan admin persona backend API',
  defaultPort: 3201,
});
