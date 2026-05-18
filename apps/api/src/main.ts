import { bootstrapHttpApp } from '@app/common';
import { ApiModule } from './api.module';

void bootstrapHttpApp({
  module: ApiModule,
  loggerName: 'ApiBootstrap',
  swaggerTitle: 'Tribe Backend',
  swaggerDescription: 'Tribe Backend API',
  defaultPort: 3000,
});
