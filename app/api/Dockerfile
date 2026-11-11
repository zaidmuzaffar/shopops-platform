# syntax=docker/dockerfile:1
# ---------------------------------------------------------------
# Inventory API image — multi-stage build
#   deps    : installs production dependencies only
#   test    : installs everything and runs the tests (docker build --target test .)
#   runtime : the small final image that actually ships
# ---------------------------------------------------------------

# ---- Stage 1: production dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
# Copy only the dependency files first: Docker caches this layer, so
# "npm ci" re-runs only when package*.json change, not on every code edit.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 2: tests (optional target) ----
FROM node:22-alpine AS test
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test

# ---- Stage 3: runtime ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Only what the app needs to run: no tests, no dev tools, no npm cache.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# Never run as root: the official image ships an unprivileged "node" user.
USER node

EXPOSE 3000

# Docker checks this every 15s; "unhealthy" containers can be restarted or skipped.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

# Exec form (JSON array): node is PID 1 and receives SIGTERM directly,
# so the graceful shutdown in server.js works.
CMD ["node", "src/server.js"]
