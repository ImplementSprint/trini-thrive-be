import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SitemanagerModule } from './sitemanager.module';

async function bootstrap() {
  const logger = new Logger('BayaniHubSitemanagerBootstrap');
  const app = await NestFactory.create(SitemanagerModule);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  });

  const port = Number(process.env['BAYANIHUB_SITEMANAGER_PORT'] ?? 3003);
  await app.listen(port, '0.0.0.0');
  logger.log(`bayanihub-sitemanager-service running on port ${port}`);
}
bootstrap();
