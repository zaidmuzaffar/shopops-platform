// Metrics tests: /metrics must speak the Prometheus text format, count real traffic,
// and keep labels low-cardinality (a product ID must never become a label).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { MemoryStore } = require('../src/store');
const { createMetrics, routeLabel } = require('../src/metrics');

async function startApp() {
  const app = createApp({ store: new MemoryStore(), config: { version: 'test', webDir: '' } });
  await new Promise((r) => app.server.listen(0, r));
  app.state.ready = true;
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const get = async (path) => (await fetch(base + path)).text();
  return { base, get, close: () => new Promise((r) => app.server.close(r)) };
}

test('GET /metrics answers in the Prometheus text format', async () => {
  const { base, close } = await startApp();
  const r = await fetch(base + '/metrics');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^text\/plain/);
  const body = await r.text();
  assert.match(body, /# TYPE http_requests_total counter/);
  assert.match(body, /# TYPE http_request_duration_seconds histogram/);
  assert.match(body, /shopops_build_info\{version="test"\} 1/);
  assert.match(body, /process_resident_memory_bytes \d+/);
  await close();
});

test('counts requests by method, route and status, with a duration histogram', async () => {
  const { get, close } = await startApp();
  await get('/api/products');
  await get('/api/products');
  const body = await get('/metrics');
  assert.match(body, /http_requests_total\{method="GET",route="\/api\/products",status="200"\} 2/);
  assert.match(body, /http_request_duration_seconds_count\{method="GET",route="\/api\/products"\} 2/);
  assert.match(body, /http_request_duration_seconds_bucket\{method="GET",route="\/api\/products",le="\+Inf"\} 2/);
  await close();
});

test('product IDs are grouped under one route label', async () => {
  const { get, close } = await startApp();
  await get('/api/products/987654');                 // 404: no such product
  const body = await get('/metrics');
  assert.match(body, /route="\/api\/products\/:id",status="404"/);
  assert.doesNotMatch(body, /987654/);
  await close();
});

test('health checks and /metrics itself are not counted as traffic', async () => {
  const { get, close } = await startApp();
  for (const p of ['/healthz', '/readyz', '/metrics']) await get(p);
  const body = await get('/metrics');
  assert.doesNotMatch(body, /route="\/healthz"|route="\/readyz"|route="\/metrics"/);
  await close();
});

test('histogram buckets are cumulative and routes are normalised', () => {
  const m = createMetrics({ version: 't' });
  m.observe({ method: 'GET', route: '/api/products', status: 200, seconds: 0.003 });
  m.observe({ method: 'GET', route: '/api/products', status: 200, seconds: 0.3 });
  m.observe({ method: 'BREW', route: 'other', status: 404, seconds: 0.001 });
  const body = m.render();
  const bucket = (le) => body.match(new RegExp(`_bucket\\{method="GET",route="/api/products",le="${le}"\\} (\\d+)`))[1];
  assert.equal(bucket('0.005'), '1');
  assert.equal(bucket('0.25'), '1');
  assert.equal(bucket('0.5'), '2');
  assert.equal(bucket('\\+Inf'), '2');
  assert.match(body, /http_requests_total\{method="OTHER",route="other",status="404"\} 1/);
  assert.equal(routeLabel('/api/products/42'), '/api/products/:id');
  assert.equal(routeLabel('/healthz'), null);
});
