import '@shared/load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AuthModule } from './auth.module';
import { SERVICE_PORTS } from '@shared/constants';
import { findAvailablePort } from '@shared/port-finder';
import { HttpExceptionFilter, AllExceptionsFilter } from '@shared/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  const port = await findAvailablePort(SERVICE_PORTS.AUTH);
  await app.listen(port, '0.0.0.0');
  console.log(`\n✅ AuthService running on port ${port}`);
}

bootstrap();
