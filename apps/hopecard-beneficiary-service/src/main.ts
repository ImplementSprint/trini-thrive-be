import { bootstrapHttpApp } from '@app/common';
import { HopecardBeneficiaryServiceModule } from './beneficiary-service.module';

process.env.PORT = process.env.HOPECARD_BENE_PORT ?? '3102';

void bootstrapHttpApp({
  module: HopecardBeneficiaryServiceModule,
  loggerName: 'HopecardBeneficiaryService',
  swaggerTitle: 'Hopecard Beneficiary Service',
  swaggerDescription: 'Hopecard beneficiary backend API',
  defaultPort: 3102,
});
