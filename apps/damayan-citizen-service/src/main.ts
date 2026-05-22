import { bootstrapHttpApp } from '@app/common';
import { DamayanCitizenServiceModule } from './citizen-service.module';

process.env.PORT = process.env.DAMAYAN_CITIZEN_PORT ?? '3204';

void bootstrapHttpApp({
  module: DamayanCitizenServiceModule,
  loggerName: 'DamayanCitizenService',
  swaggerTitle: 'Damayan Citizen Service',
  swaggerDescription: 'Damayan citizen persona backend API',
  defaultPort: 3204,
});
