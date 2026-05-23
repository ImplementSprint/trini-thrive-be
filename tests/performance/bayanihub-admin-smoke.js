import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
};

const baseUrl = __ENV.BASE_URL || __ENV.K6_BASE_URL || 'http://localhost:3301';

export default function smokeTest() {
  const healthRes = http.get(`${baseUrl}/api/v1/bayanihub/admin/health`);
  check(healthRes, {
    'admin health status is 200': (r) => r.status === 200,
  });

  const loginRes = http.post(
    `${baseUrl}/api/v1/bayanihub/admin/auth/login`,
    JSON.stringify({ email: __ENV.ADMIN_EMAIL || 'admin@example.com', password: __ENV.ADMIN_PASSWORD || 'password' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(loginRes, {
    'admin login returns 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}
