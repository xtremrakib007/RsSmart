import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const syncDuration = new Trend('sync_duration');

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api.yourdomain.com';
const API_KEY = __ENV.API_KEY;

export default function () {
  group('POS Operations', () => {
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      username: `pos_${__VU}`,
      password: 'test-password',
    }), { headers: { 'Content-Type': 'application/json' } });

    check(loginRes, { 'login success': (r) => r.status === 200 }) || errorRate.add(1);

    const token = loginRes.json('token');
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const searchRes = http.get(`${BASE_URL}/api/products?search=laptop&limit=20`, { headers });
    check(searchRes, { 'search success': (r) => r.status === 200 }) || errorRate.add(1);

    const transaction = {
      items: [
        { productId: 'prod-1', quantity: 2, price: 29.99 },
        { productId: 'prod-2', quantity: 1, price: 49.99 },
      ],
      payment: { method: 'cash', amount: 110.00 },
      posTerminalId: `terminal-${__VU}`,
    };

    const txRes = http.post(`${BASE_URL}/api/transactions`, JSON.stringify(transaction), { headers });
    check(txRes, {
      'transaction created': (r) => r.status === 201,
      'transaction has id': (r) => r.json('id') !== undefined,
    }) || errorRate.add(1);

    const syncStart = Date.now();
    const syncRes = http.post(`${BASE_URL}/api/sync`, JSON.stringify({
      lastSyncTimestamp: new Date(Date.now() - 3600000).toISOString(),
      deviceId: `device-${__VU}`,
    }), { headers });
    syncDuration.add(Date.now() - syncStart);

    check(syncRes, { 'sync success': (r) => r.status === 200 }) || errorRate.add(1);
  });

  sleep(1);
}
