// Entry point: connect to storage, start HTTP, and shut down gracefully.
const config = require('./config');
const log = require('./logger');
const { createStore } = require('./store');
const { createApp } = require('./app');

async function main() {
  const store = createStore(config.databaseUrl);
  const { server, state } = createApp({ store, config });

  // Retry the database a few times: in Docker/Kubernetes the DB may start after the API.
  for (let attempt = 1; ; attempt++) {
    try { await store.init(); break; }
    catch (err) {
      if (attempt >= 10) { log.error('database not reachable, giving up', { error: err.message }); process.exit(1); }
      log.warn('database not ready, retrying', { attempt, error: err.message });
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  server.listen(config.port, () => {
    state.ready = true;
    log.info('api started', { port: config.port, store: config.databaseUrl ? 'postgres' : 'memory', version: config.version });
  });

  // Graceful shutdown: Kubernetes sends SIGTERM before stopping a pod.
  // Stop taking new traffic, finish current requests, close the DB, then exit.
  const shutdown = (signal) => {
    if (state.shuttingDown) return;
    state.shuttingDown = true;
    log.info('shutting down', { signal });
    server.close(async () => { await store.close(); log.info('bye'); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
