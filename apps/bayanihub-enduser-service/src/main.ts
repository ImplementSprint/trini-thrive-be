import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { EnduserModule } from './enduser.module';

async function bootstrap() {
  const app = await NestFactory.create(EnduserModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  const port = Number(process.env['BAYANIHUB_ENDUSER_PORT'] ?? 3302);
  await app.listen(port, '0.0.0.0');
  console.log(`bayanihub-enduser-service running on port ${port}`);
}
bootstrap();
