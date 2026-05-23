import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SitemanagerModule } from '../../apps/bayanihub-sitemanager-service/src/sitemanager.module';

describe('BayaniHub Site Manager Service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SitemanagerModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth', () => {
    it('POST /api/v1/bayanihub/site-manager/auth/login — rejects missing credentials', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .post('/api/v1/bayanihub/site-manager/auth/login')
        .send({})
        .expect((res: { status: number }) => {
          expect([400, 401, 422]).toContain(res.status);
        });
    });

    it('POST /api/v1/bayanihub/site-manager/auth/login — rejects invalid credentials', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .post('/api/v1/bayanihub/site-manager/auth/login')
        .send({ email: 'notreal@example.com', password: 'wrongpassword' })
        .expect((res: { status: number }) => {
          expect([400, 401, 403]).toContain(res.status);
        });
    });

    it('POST /api/v1/bayanihub/site-manager/auth/send-otp — rejects missing email', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .post('/api/v1/bayanihub/site-manager/auth/send-otp')
        .send({})
        .expect((res: { status: number }) => {
          expect([400, 422]).toContain(res.status);
        });
    });
  });

  describe('Protected routes (unauthenticated)', () => {
    it('GET /api/v1/bayanihub/site-manager/auth/profile — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/site-manager/auth/profile')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/site-manager/campaigns — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/site-manager/campaigns')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/site-manager/missions — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/site-manager/missions')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/site-manager/volunteer-roles — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/site-manager/volunteer-roles')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/site-manager/shifts/pending — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/site-manager/shifts/pending')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/site-manager/notifications — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/site-manager/notifications')
        .expect(401);
    });
  });

  describe('Wrong persona rejection', () => {
    it('GET /api/v1/bayanihub/site-manager/auth/profile — rejects malformed token', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/site-manager/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect((res: { status: number }) => {
          expect([401, 403]).toContain(res.status);
        });
    });
  });
});
