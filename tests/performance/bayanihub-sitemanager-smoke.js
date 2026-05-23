import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
};

const baseUrl = __ENV.BASE_URL || __ENV.K6_BASE_URL || 'http://localhost:3303';

export default function smokeTest() {
  const healthRes = http.get(`${baseUrl}/api/v1/bayanihub/site-manager/health`);
  check(healthRes, {
    'sitemanager health status is 200': (r) => r.status === 200,
  });

  const loginRes = http.post(
    `${baseUrl}/api/v1/bayanihub/site-manager/auth/login`,
    JSON.stringify({ email: __ENV.SITEMAN_EMAIL || 'siteman@example.com', password: __ENV.SITEMAN_PASSWORD || 'password' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(loginRes, {
    'sitemanager login returns 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  const campaignsRes = http.get(`${baseUrl}/api/v1/bayanihub/site-manager/campaigns`);
  check(campaignsRes, {
    'campaigns endpoint reachable': (r) => r.status === 200 || r.status === 401 || r.status === 403,
  });

  sleep(1);
}
