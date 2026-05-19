import { bootstrapHttpApp } from '@app/common';
import { HopecardBeneficiaryServiceModule } from './beneficiary-service.module';

void bootstrapHttpApp({
  module: HopecardBeneficiaryServiceModule,
  loggerName: 'HopecardBeneficiaryService',
  swaggerTitle: 'Hopecard Beneficiary Service',
  swaggerDescription: 'Hopecard beneficiary backend API',
  defaultPort: 4021,
});
