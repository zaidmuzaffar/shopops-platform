// API tests: start the app on a random port with the in-memory store and call it over HTTP.
// Run with: npm test   (CI runs the same command on every push)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { MemoryStore } = require('../src/store');

let server, base;

before(async () => {
  const app = createApp({ store: new MemoryStore(), config: { version: 'test', webDir: '' } });
  server = app.server;
  await new Promise((r) => server.listen(0, r));
  app.state.ready = true;
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((r) => server.close(r)));

const json = (path, opts = {}) =>
  fetch(base + path, { headers: { 'Content-Type': 'application/json' }, ...opts })
    .then(async (r) => ({ status: r.status, body: r.status === 204 ? null : await r.json() }));

test('liveness and readiness checks answer', async () => {
  assert.equal((await json('/healthz')).status, 200);
  assert.equal((await json('/readyz')).status, 200);
});

test('creates, lists, updates and deletes a product', async () => {
  const created = await json('/api/products', { method: 'POST', body: JSON.stringify({ name: 'Golden Pump 1HP', category: 'pump', price: 18500, quantity: 4 }) });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, 'Golden Pump 1HP');

  const list = await json('/api/products');
  assert.equal(list.body.length, 1);

  const updated = await json(`/api/products/${created.body.id}`, { method: 'PATCH', body: JSON.stringify({ quantity: 3 }) });
  assert.equal(updated.body.quantity, 3);

  assert.equal((await json(`/api/products/${created.body.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await json(`/api/products/${created.body.id}`)).status, 404);
});

test('rejects invalid products with a clear message', async () => {
  const bad = await json('/api/products', { method: 'POST', body: JSON.stringify({ name: '', price: -5, quantity: 1.5 }) });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /name is required/);
  assert.match(bad.body.error, /price/);
});

test('rejects malformed JSON', async () => {
  const r = await fetch(base + '/api/products', { method: 'POST', body: '{oops' });
  assert.equal(r.status, 400);
});

test('unknown routes return 404', async () => {
  assert.equal((await json('/nope')).status, 404);
});

test('serves the web UI from a relative WEB_DIR and blocks path traversal', async () => {
  const path = require('node:path');
  const app = createApp({ store: new MemoryStore(), config: { version: 't', webDir: path.relative(process.cwd(), path.join(__dirname, '..', '..', 'web')) } });
  await new Promise((r) => app.server.listen(0, r));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const home = await fetch(url + '/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /ShopOps/);
  const sneaky = await fetch(url + '/..%2f..%2fpackage.json');
  assert.equal(sneaky.status, 404);
  await new Promise((r) => app.server.close(r));
});
