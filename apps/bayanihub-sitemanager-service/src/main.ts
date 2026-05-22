import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SitemanagerModule } from './sitemanager.module';

async function bootstrap() {
  const app = await NestFactory.create(SitemanagerModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  const port = Number(process.env['BAYANIHUB_SITEMANAGER_PORT'] ?? 3303);
  await app.listen(port, '0.0.0.0');
  console.log(`bayanihub-sitemanager-service running on port ${port}`);
}
bootstrap();
