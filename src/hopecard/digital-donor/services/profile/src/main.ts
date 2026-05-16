import '@shared/load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ProfileModule } from './profile.module';
import { SERVICE_PORTS } from '@shared/constants';
import { findAvailablePort } from '@shared/port-finder';
import { HttpExceptionFilter, AllExceptionsFilter } from '@shared/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(ProfileModule);
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  const port = await findAvailablePort(SERVICE_PORTS.PROFILE);
  await app.listen(port, '0.0.0.0');
  console.log(`\n✅ ProfileService running on port ${port}`);
}

bootstrap();
