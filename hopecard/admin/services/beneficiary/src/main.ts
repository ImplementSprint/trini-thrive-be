import { NestFactory } from '@nestjs/core';
import { BeneficiariesModule } from './beneficiaries.module';
import { SERVICE_PORTS } from '@shared/constants';
import { findAvailablePort } from '@shared/port-finder';
import { HttpExceptionFilter } from '@shared/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(BeneficiariesModule);
  
  app.enableCors();
  app.useGlobalFilters(new HttpExceptionFilter());
  
  const port = await findAvailablePort(SERVICE_PORTS.BENEFICIARY);
  await app.listen(port, '0.0.0.0');
  console.log(`\n👨‍💼 Beneficiary Service running on port ${port}`);
}

bootstrap();
