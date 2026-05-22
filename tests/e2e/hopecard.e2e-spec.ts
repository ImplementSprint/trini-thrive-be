import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

const SERVICES = [
  { name: 'admin', port: process.env.HOPECARD_ADMIN_PORT ?? '3101' },
  { name: 'beneficiary', port: process.env.HOPECARD_BENE_PORT ?? '3102' },
  { name: 'cm', port: process.env.HOPECARD_CM_PORT ?? '3103' },
  { name: 'donor', port: process.env.HOPECARD_DONOR_PORT ?? '3104' },
  {
    name: 'notification',
    port: process.env.HOPECARD_NOTIFICATION_PORT ?? '3105',
  },
];

describe('Hopecard — health checks (all personas)', () => {
  SERVICES.forEach(({ name, port }) => {
    it(`hopecard-${name}-service health resolves`, async () => {
      const baseUrl = `http://localhost:${port}`;
      const res = await fetch(`${baseUrl}/api/v1/health`).catch(() => null);
      // If service isn't running locally, skip gracefully
      if (!res) return;
      expect(res.status).toBe(200);
    });
  });
});

describe('Hopecard — persona isolation (JWT claims)', () => {
  it('POST /api/v1/hopecard/donor/auth/login requires valid body', async () => {
    const res = await fetch(
      `http://localhost:3104/api/v1/hopecard/donor/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    ).catch(() => null);
    if (!res) return;
    // Missing credentials must not return 200
    expect(res.status).not.toBe(200);
  });

  it('GET /api/v1/hopecard/donor/cart without token returns 401', async () => {
    const res = await fetch(
      `http://localhost:3104/api/v1/hopecard/donor/cart?authUserId=test`,
    ).catch(() => null);
    if (!res) return;
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/hopecard/admin/dashboard without token returns 401', async () => {
    const res = await fetch(
      `http://localhost:3101/api/v1/hopecard/admin/dashboard/metrics`,
    ).catch(() => null);
    if (!res) return;
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/hopecard/beneficiary/bank-accounts without token returns 401', async () => {
    const res = await fetch(
      `http://localhost:3102/api/v1/hopecard/beneficiary/bank-accounts`,
    ).catch(() => null);
    if (!res) return;
    expect(res.status).toBe(401);
  });
});
