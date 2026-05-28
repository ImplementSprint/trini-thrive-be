import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AdminModule } from './admin.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('BayaniHubAdminBootstrap');
  const app = await NestFactory.create(AdminModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  });

  const port = Number(process.env['BAYANIHUB_ADMIN_PORT'] ?? 3004);
  await app.listen(port, '0.0.0.0');
  logger.log(`bayanihub-admin-service running on port ${String(port)}`);
}

void bootstrap();
