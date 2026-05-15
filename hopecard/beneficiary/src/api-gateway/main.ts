import { resolve } from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: resolve(__dirname, '../../../.env.local') });

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);

  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.API_GATEWAY_PORT ?? process.env.PORT ?? 5000);
  await app.listen(port);

  Logger.log(
    `API gateway listening on http://localhost:${port}/api`,
    'ApiGatewayBootstrap',
  );
}

bootstrap();
