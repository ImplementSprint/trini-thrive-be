import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AdminModule } from '../../apps/bayanihub-admin-service/src/admin.module';

describe('BayaniHub Admin Service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AdminModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth', () => {
    it('POST /api/v1/bayanihub/admin/auth/login — rejects missing credentials', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .post('/api/v1/bayanihub/admin/auth/login')
        .send({})
        .expect((res: { status: number }) => {
          expect([400, 401, 422]).toContain(res.status);
        });
    });

    it('POST /api/v1/bayanihub/admin/auth/login — rejects invalid credentials', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .post('/api/v1/bayanihub/admin/auth/login')
        .send({ email: 'notareal@admin.com', password: 'wrongpassword' })
        .expect((res: { status: number }) => {
          expect([400, 401, 403]).toContain(res.status);
        });
    });
  });

  describe('Protected routes (unauthenticated)', () => {
    it('GET /api/v1/bayanihub/admin/auth/profile — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/admin/auth/profile')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/admin/dashboard — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/admin/dashboard')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/admin/campaigns — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/admin/campaigns')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/admin/volunteers — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/admin/volunteers')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/admin/donors — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/admin/donors')
        .expect(401);
    });

    it('GET /api/v1/bayanihub/admin/notifications — requires JWT', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/admin/notifications')
        .expect(401);
    });
  });

  describe('Wrong persona rejection', () => {
    it('GET /api/v1/bayanihub/admin/auth/profile — rejects wrong-persona token', () => {
      const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
      return request(httpServer)
        .get('/api/v1/bayanihub/admin/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect((res: { status: number }) => {
          expect([401, 403]).toContain(res.status);
        });
    });
  });
});
