import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
};

const baseUrl = __ENV.BASE_URL || __ENV.K6_BASE_URL || 'http://localhost:3302';

export default function smokeTest() {
  const healthRes = http.get(`${baseUrl}/api/v1/bayanihub/enduser/health`);
  check(healthRes, {
    'enduser health status is 200': (r) => r.status === 200,
  });

  const loginRes = http.post(
    `${baseUrl}/api/v1/bayanihub/enduser/auth/login`,
    JSON.stringify({ email: __ENV.ENDUSER_EMAIL || 'user@example.com', password: __ENV.ENDUSER_PASSWORD || 'password' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(loginRes, {
    'enduser login returns 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  const campaignsRes = http.get(`${baseUrl}/api/v1/bayanihub/enduser/forms/campaigns`);
  check(campaignsRes, {
    'campaigns endpoint reachable': (r) => r.status === 200 || r.status === 401 || r.status === 403,
  });

  sleep(1);
}
