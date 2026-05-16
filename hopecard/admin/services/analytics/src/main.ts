import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AnalyticsModule } from './analytics.module';
import { SERVICE_PORTS } from '@shared/constants';
import { findAvailablePort } from '@shared/port-finder';
import { HttpExceptionFilter } from '@shared/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AnalyticsModule);
  
  app.enableCors();
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = await findAvailablePort(SERVICE_PORTS.ANALYTICS);
  const tcpPort = await findAvailablePort(SERVICE_PORTS.ANALYTICS_TCP);

  // Connect TCP microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: tcpPort,
    },
  });

  await app.startAllMicroservices();
  await app.listen(port);
  
  console.log(`\n📊 Analytics Service: HTTP on ${port}, TCP on ${tcpPort}`);
}

bootstrap();
