import '@shared/load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { PurchasesModule } from './purchases.module';
import { SERVICE_PORTS } from '@shared/constants';
import { findAvailablePort } from '@shared/port-finder';
import { HttpExceptionFilter, AllExceptionsFilter } from '@shared/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(PurchasesModule);
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  const port = await findAvailablePort(SERVICE_PORTS.PURCHASES);
  await app.listen(port, '0.0.0.0');
  console.log(`\n✅ PurchasesService running on port ${port}`);
}

bootstrap();
