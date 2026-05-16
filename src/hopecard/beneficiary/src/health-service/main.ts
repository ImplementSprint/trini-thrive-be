import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { HealthModule } from './health.module';

async function bootstrap() {
  const host = process.env.HEALTH_SERVICE_HOST ?? '127.0.0.1';
  const port = Number(process.env.HEALTH_SERVICE_PORT ?? 4001);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    HealthModule,
    {
      transport: Transport.TCP,
      options: {
        host,
        port,
      },
    },
  );

  await app.listen();

  Logger.log(
    `Health microservice listening on tcp://${host}:${port}`,
    'HealthServiceBootstrap',
  );
}

bootstrap();
