import { bootstrapHttpApp } from '@app/common';
import { HopecardDonorServiceModule } from './donor-service.module';

process.env.PORT = process.env.HOPECARD_DONOR_PORT ?? '3104';

void bootstrapHttpApp({
  module: HopecardDonorServiceModule,
  loggerName: 'HopecardDonorService',
  swaggerTitle: 'Hopecard Donor Service',
  swaggerDescription: 'Hopecard donor backend API',
  defaultPort: 3104,
});
