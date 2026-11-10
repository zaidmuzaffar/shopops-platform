// Structured JSON logs: one JSON object per line.
// Log collectors (Loki, CloudWatch, ELK) can search fields like level or path.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const min = LEVELS[require('./config').logLevel] || 20;

function log(level, msg, fields = {}) {
  if (LEVELS[level] < min) return;
  const line = { time: new Date().toISOString(), level, msg, ...fields };
  (level === 'error' ? process.stderr : process.stdout).write(JSON.stringify(line) + '\n');
}

module.exports = {
  debug: (m, f) => log('debug', m, f),
  info: (m, f) => log('info', m, f),
  warn: (m, f) => log('warn', m, f),
  error: (m, f) => log('error', m, f),
};
