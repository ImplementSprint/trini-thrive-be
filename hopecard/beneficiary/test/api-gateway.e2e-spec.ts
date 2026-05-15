import { INestApplication, INestMicroservice } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as request from 'supertest';

import { ApiGatewayModule } from '../src/api-gateway/api-gateway.module';
import { HealthModule } from '../src/health-service/health.module';

describe('API Gateway (e2e)', () => {
  let app: INestApplication;
  let healthMicroservice: INestMicroservice;

  beforeAll(async () => {
    process.env.HEALTH_SERVICE_HOST = '127.0.0.1';
    process.env.HEALTH_SERVICE_PORT = '4101';

    healthMicroservice =
      await NestFactory.createMicroservice<MicroserviceOptions>(HealthModule, {
        transport: Transport.TCP,
        options: {
          host: process.env.HEALTH_SERVICE_HOST,
          port: Number(process.env.HEALTH_SERVICE_PORT),
        },
      });

    await healthMicroservice.listen();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiGatewayModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await healthMicroservice.close();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('ok');
        expect(response.body.service).toBe('beneficiary-health-service');
      });
  });
});
