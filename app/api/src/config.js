// All settings come from environment variables (12-factor app).
// The same code runs on your laptop, in Docker and in Kubernetes —
// only the environment changes.
module.exports = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || '',          // empty = in-memory store
  webDir: process.env.WEB_DIR || '',                    // folder with the web UI to serve (dev only)
  logLevel: process.env.LOG_LEVEL || 'info',
  version: process.env.APP_VERSION || require('../package.json').version,
};
