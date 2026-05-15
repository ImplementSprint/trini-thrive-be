// cm-backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Enable CORS so your Next.js frontend can talk to this API
  app.enableCors();

  // 2. Enable validation for the DTOs
  app.useGlobalPipes(new ValidationPipe());

  await app.listen(3001);
  console.log(`Backend is running on: http://localhost:3001`);
}
bootstrap();
