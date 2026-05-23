import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AdminModule } from './admin.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('BayaniHubAdminBootstrap');
  const app = await NestFactory.create(AdminModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: (process.env['ALLOWED_ORIGINS'] ?? '').split(',').map((o) => o.trim()).filter(Boolean),
    credentials: true,
  });

  const port = Number(process.env['BAYANIHUB_ADMIN_PORT'] ?? 3301);
  await app.listen(port, '0.0.0.0');
  logger.log(`bayanihub-admin-service running on port ${String(port)}`);
}

void bootstrap();
