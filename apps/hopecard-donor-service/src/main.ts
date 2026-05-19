import { bootstrapHttpApp } from '@app/common';
import { HopecardDonorServiceModule } from './donor-service.module';

void bootstrapHttpApp({
  module: HopecardDonorServiceModule,
  loggerName: 'HopecardDonorService',
  swaggerTitle: 'Hopecard Donor Service',
  swaggerDescription: 'Hopecard donor backend API',
  defaultPort: 4024,
});
