// Prometheus metrics for the API, written by hand in the Prometheus text format.
// No metrics library is needed, so the API keeps a single dependency (pg).
//
// What is measured (the "RED" method):
//   Rate     -> http_requests_total              how many requests arrive
//   Errors   -> http_requests_total{status=5xx}  how many of them fail
//   Duration -> http_request_duration_seconds    how long they take (histogram)
// plus the running version and a few process metrics (memory, CPU).
//
// Prometheus reads GET /metrics every 30 seconds. The endpoint is only reachable
// inside the cluster: Nginx forwards /api/ and /readyz to the API, never /metrics.

const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]; // seconds
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

// Turn a URL path into one of a few fixed route names. Raw paths must never become
// labels: /api/products/1, /api/products/2 ... would create a new time series per product.
function routeLabel(pathname) {
  if (pathname === '/healthz' || pathname === '/readyz' || pathname === '/metrics') return null; // probes are not traffic
  if (pathname === '/api/version') return '/api/version';
  if (pathname === '/api/products') return '/api/products';
  if (/^\/api\/products\/\d+$/.test(pathname)) return '/api/products/:id';
  return 'other';
}

const esc = (v) => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const labels = (obj) => '{' + Object.entries(obj).map(([k, v]) => `${k}="${esc(v)}"`).join(',') + '}';

function createMetrics({ version }) {
  const requests = new Map();  // "method|route|status" -> count
  const durations = new Map(); // "method|route"        -> { buckets, sum, count }
  const startTime = Math.floor(Date.now() / 1000 - process.uptime());

  function observe({ method, route, status, seconds }) {
    const m = METHODS.has(method) ? method : 'OTHER';   // unknown methods would also create new series
    const rKey = `${m}|${route}|${status}`;
    requests.set(rKey, (requests.get(rKey) || 0) + 1);

    const dKey = `${m}|${route}`;
    let h = durations.get(dKey);
    if (!h) { h = { buckets: BUCKETS.map(() => 0), sum: 0, count: 0 }; durations.set(dKey, h); }
    BUCKETS.forEach((le, i) => { if (seconds <= le) h.buckets[i] += 1; }); // cumulative, as Prometheus expects
    h.sum += seconds;
    h.count += 1;
  }

  function render() {
    const out = [];
    const family = (name, type, help) => out.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`);

    family('shopops_build_info', 'gauge', 'Version of the running API (the value is always 1).');
    out.push(`shopops_build_info${labels({ version })} 1`);

    family('http_requests_total', 'counter', 'HTTP requests handled, by method, route and status code.');
    for (const [key, n] of requests) {
      const [method, route, status] = key.split('|');
      out.push(`http_requests_total${labels({ method, route, status })} ${n}`);
    }

    family('http_request_duration_seconds', 'histogram', 'Time taken to answer HTTP requests, in seconds.');
    for (const [key, h] of durations) {
      const [method, route] = key.split('|');
      BUCKETS.forEach((le, i) => out.push(`http_request_duration_seconds_bucket${labels({ method, route, le })} ${h.buckets[i]}`));
      out.push(`http_request_duration_seconds_bucket${labels({ method, route, le: '+Inf' })} ${h.count}`);
      out.push(`http_request_duration_seconds_sum${labels({ method, route })} ${h.sum}`);
      out.push(`http_request_duration_seconds_count${labels({ method, route })} ${h.count}`);
    }

    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    family('process_resident_memory_bytes', 'gauge', 'Resident memory size in bytes.');
    out.push(`process_resident_memory_bytes ${mem.rss}`);
    family('nodejs_heap_used_bytes', 'gauge', 'V8 heap memory in use, in bytes.');
    out.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);
    family('process_cpu_seconds_total', 'counter', 'User and system CPU time spent, in seconds.');
    out.push(`process_cpu_seconds_total ${(cpu.user + cpu.system) / 1e6}`);
    family('process_start_time_seconds', 'gauge', 'Start time of the process since the Unix epoch, in seconds.');
    out.push(`process_start_time_seconds ${startTime}`);

    return out.join('\n') + '\n';
  }

  return { observe, render };
}

module.exports = { createMetrics, routeLabel, BUCKETS, CONTENT_TYPE };
