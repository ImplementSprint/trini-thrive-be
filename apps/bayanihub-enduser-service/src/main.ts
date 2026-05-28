import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { EnduserModule } from './enduser.module';

async function bootstrap() {
  const logger = new Logger('BayaniHubEnduserBootstrap');
  const app = await NestFactory.create(EnduserModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  });

  const port = Number(process.env['BAYANIHUB_ENDUSER_PORT'] ?? 3001);
  await app.listen(port, '0.0.0.0');
  logger.log(`bayanihub-enduser-service running on port ${port}`);
}
bootstrap();
