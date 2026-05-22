import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<2000'] },
};

const BASE = __ENV.HOPECARD_DONOR_BASE_URL || 'http://localhost:3104';

export default function () {
  const res = http.get(`${BASE}/api/v1/health`);
  check(res, { 'donor health 200': (r) => r.status === 200 });
  sleep(1);
}
