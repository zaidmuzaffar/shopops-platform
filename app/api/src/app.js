// HTTP application built on Node's own http module (no framework).
// Fewer dependencies = smaller images and fewer security vulnerabilities.
const http = require('http');
const fs = require('fs');
const path = require('path');
const log = require('./logger');

const CATEGORIES = ['pump', 'wire', 'safety_cable', 'other'];
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

function send(res, status, body) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e5) reject(Object.assign(new Error('Body too large'), { status: 413 })); });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

// Validation: returns { value } or { error }.
function validateProduct(input, partial = false) {
  const out = {};
  const errors = [];
  if (!partial || input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim()) errors.push('name is required');
    else out.name = input.name.trim().slice(0, 120);
  }
  if (input.category !== undefined || !partial) {
    const c = input.category === undefined ? 'other' : input.category;
    if (!CATEGORIES.includes(c)) errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
    else out.category = c;
  }
  for (const f of ['price', 'quantity']) {
    if (!partial || input[f] !== undefined) {
      if (!Number.isInteger(input[f]) || input[f] < 0) errors.push(`${f} must be a whole number of 0 or more`);
      else out[f] = input[f];
    }
  }
  return errors.length ? { error: errors.join('; ') } : { value: out };
}

function createApp({ store, config }) {
  const state = { ready: false, shuttingDown: false };

  async function route(req, res, url) {
    const { pathname } = url;

    // ---- Health checks (used by Docker and Kubernetes) ----
    if (pathname === '/healthz') return send(res, 200, { status: 'ok' });            // liveness: process is alive
    if (pathname === '/readyz') {                                                    // readiness: can serve traffic
      if (!state.ready || state.shuttingDown) return send(res, 503, { status: 'not ready' });
      try { await store.ping(); return send(res, 200, { status: 'ready' }); }
      catch (e) { return send(res, 503, { status: 'database unavailable' }); }
    }
    if (pathname === '/api/version') return send(res, 200, { version: config.version });

    // ---- Products API ----
    const m = pathname.match(/^\/api\/products(?:\/(\d+))?$/);
    if (m) {
      const id = m[1] ? Number(m[1]) : null;
      if (req.method === 'GET' && !id) return send(res, 200, await store.list());
      if (req.method === 'GET' && id) {
        const p = await store.get(id);
        return p ? send(res, 200, p) : send(res, 404, { error: 'product not found' });
      }
      if (req.method === 'POST' && !id) {
        const { value, error } = validateProduct(await readJson(req));
        if (error) return send(res, 400, { error });
        return send(res, 201, await store.create(value));
      }
      if (req.method === 'PATCH' && id) {
        const { value, error } = validateProduct(await readJson(req), true);
        if (error) return send(res, 400, { error });
        const p = await store.update(id, value);
        return p ? send(res, 200, p) : send(res, 404, { error: 'product not found' });
      }
      if (req.method === 'DELETE' && id) {
        return (await store.remove(id)) ? send(res, 204) : send(res, 404, { error: 'product not found' });
      }
      return send(res, 405, { error: 'method not allowed' });
    }

    // ---- Web UI (only when WEB_DIR is set, for local development) ----
    if (config.webDir && req.method === 'GET') {
      const root = path.resolve(config.webDir);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      // The startsWith check blocks "../" tricks that try to read files outside the web folder.
      if (file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        return fs.createReadStream(file).pipe(res);
      }
    }
    return send(res, 404, { error: 'not found' });
  }

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, 'http://localhost');
    // Log every request when it finishes (health checks are skipped to keep logs quiet).
    res.on('finish', () => {
      if (url.pathname === '/healthz' || url.pathname === '/readyz') return;
      log.info('request', { method: req.method, path: url.pathname, status: res.statusCode, ms: Date.now() - started });
    });
    try {
      await route(req, res, url);
    } catch (err) {
      log.error('request failed', { path: url.pathname, error: err.message });
      if (!res.headersSent) send(res, err.status || 500, { error: err.status ? err.message : 'internal error' });
    }
  });

  return { server, state };
}

module.exports = { createApp, validateProduct, CATEGORIES };
