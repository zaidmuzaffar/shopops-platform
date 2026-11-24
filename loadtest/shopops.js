// k6 load test for ShopOps (Phase 7).
//
//   k6 run loadtest/shopops.js              full test, about 2.5 minutes
//   k6 run -e SMOKE=1 loadtest/shopops.js   quick check that the script and the site work
//   k6 run -e BASE_URL=https://shop.example.com loadtest/shopops.js
//
// Two kinds of traffic at the same time, like the real shop: shoppers who browse the
// product list (most of the load), and staff who add, change and remove stock. Every
// product the test creates is deleted again, so the database stays as it was. If a run is
// stopped half-way, look for leftover products named "k6 test ...".
//
// The thresholds are the pass/fail line: k6 exits with an error if any is crossed, so the
// same script can later gate a deployment in CI. p95 < 500 ms is the same line as the
// ShopOpsApiSlow alert.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'https://localhost:8443';
const SMOKE = __ENV.SMOKE === '1';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const full = {
  shoppers: {
    executor: 'ramping-vus',
    exec: 'browse',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 20 }, // ramp up
      { duration: '1m', target: 20 },  // steady
      { duration: '30s', target: 50 }, // busy moment
      { duration: '30s', target: 0 },  // ramp down
    ],
  },
  staff: {
    executor: 'constant-arrival-rate',
    exec: 'manage',
    rate: 2, // stock changes per second
    timeUnit: '1s',
    duration: '2m30s',
    preAllocatedVUs: 5,
  },
};

const smoke = {
  smoke: { executor: 'per-vu-iterations', exec: 'smokeTest', vus: 1, iterations: 3 },
};

export const options = {
  // The site's certificate comes from the chart's local CA, which is not in the Mac's trust
  // store. TLS itself is checked separately (curl --cacert); this test measures speed.
  insecureSkipTLSVerify: true,
  scenarios: SMOKE ? smoke : full,
  thresholds: {
    http_req_failed: ['rate<0.01'],   // fewer than 1% of requests fail
    http_req_duration: ['p(95)<500'], // 95% of requests answer within 500 ms
    checks: ['rate>0.99'],            // the responses are also correct
  },
};

// A shopper: open the product list, then one product, then read for a second.
// Shoppers only open real products. A product the staff scenario creates can be deleted
// again between the list and the click; the 404 that follows would be the test tripping
// over itself, not the shop failing (the first full run had 17 of those in 7,460 requests).
export function browse() {
  const list = http.get(`${BASE}/api/products`, { tags: { name: 'GET /api/products' } });
  check(list, { 'list is 200': (r) => r.status === 200 });
  const items = list.status === 200 ? list.json().filter((p) => !String(p.name).startsWith('k6 test')) : [];
  if (items.length > 0) {
    const p = items[Math.floor(Math.random() * items.length)];
    const one = http.get(`${BASE}/api/products/${p.id}`, { tags: { name: 'GET /api/products/:id' } });
    check(one, { 'product is 200': (r) => r.status === 200 });
  }
  sleep(1);
}

// Staff: add a product, change its stock, remove it again.
export function manage() {
  const body = JSON.stringify({ name: `k6 test ${__VU}-${__ITER}`, category: 'other', price: 100, quantity: 1 });
  const created = http.post(`${BASE}/api/products`, body, { headers: JSON_HEADERS, tags: { name: 'POST /api/products' } });
  if (!check(created, { 'created is 201': (r) => r.status === 201 })) return;
  const id = created.json('id');
  const updated = http.patch(`${BASE}/api/products/${id}`, JSON.stringify({ quantity: 2 }), {
    headers: JSON_HEADERS,
    tags: { name: 'PATCH /api/products/:id' },
  });
  check(updated, { 'updated is 200': (r) => r.status === 200 });
  const removed = http.del(`${BASE}/api/products/${id}`, null, { tags: { name: 'DELETE /api/products/:id' } });
  check(removed, { 'deleted is 204': (r) => r.status === 204 });
}

export function smokeTest() {
  browse();
  manage();
}

// Lets "k6 run --vus N --duration T" work too (that replaces the scenarios above).
export default function () {
  browse();
}
