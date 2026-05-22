import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EnduserModule } from '../../apps/bayanihub-enduser-service/src/enduser.module';

describe('BayaniHub Enduser Service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EnduserModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth', () => {
    it('POST /api/v1/bayanihub/enduser/auth/login — rejects missing credentials', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .post('/api/v1/bayanihub/enduser/auth/login')
        .send({})
        .expect((res: { status: number }) => {
          expect([400, 401, 422]).toContain(res.status);
        });
    });

    it('POST /api/v1/bayanihub/enduser/auth/login — rejects invalid credentials', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .post('/api/v1/bayanihub/enduser/auth/login')
        .send({ email: 'notreal@example.com', password: 'wrongpassword' })
        .expect((res: { status: number }) => {
          expect([400, 401, 403]).toContain(res.status);
        });
    });

    it('POST /api/v1/bayanihub/enduser/auth/forgot-password — rejects missing email', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .post('/api/v1/bayanihub/enduser/auth/forgot-password')
        .send({})
        .expect((res: { status: number }) => {
          expect([400, 422]).toContain(res.status);
        });
    });
  });

  describe('Protected routes (unauthenticated)', () => {
    it('GET /api/v1/bayanihub/enduser/auth/profile — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/enduser/auth/profile')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/enduser/forms/campaigns — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/enduser/forms/campaigns')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/enduser/forms/my-applications — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/enduser/forms/my-applications')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/enduser/forms/my-missions — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/enduser/forms/my-missions')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/enduser/notifications — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/enduser/notifications')
        .expect(401);
    });
  });

  describe('Wrong persona rejection', () => {
    it('GET /api/v1/bayanihub/enduser/auth/profile — rejects malformed token', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/enduser/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect((res: { status: number }) => {
          expect([401, 403]).toContain(res.status);
        });
    });
  });
});
