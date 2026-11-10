# Phase 0 — Notes

What was built and **why each choice matters for operations**. These are the points to explain in an interview.

## 1. Configuration comes from the environment
`src/config.js` reads `PORT`, `DATABASE_URL`, `LOG_LEVEL`… from environment variables.
The same build runs on a laptop, in Docker and in Kubernetes; only the environment changes. Nothing secret is written in the code. This is factor III of the *12-factor app*.

## 2. Two health endpoints, not one
- `/healthz` (**liveness**) — "the process is alive". If it fails, Kubernetes restarts the container.
- `/readyz` (**readiness**) — "I can serve traffic right now" (database reachable, not shutting down). If it fails, Kubernetes stops sending traffic but does **not** restart.
Mixing them up causes restart loops whenever the database blips.

## 3. Graceful shutdown
On `SIGTERM` (what Kubernetes sends before stopping a pod) the server marks itself not-ready, finishes in-flight requests, closes the database pool and exits. This is what makes **zero-downtime deployments** possible later.

## 4. Startup retries
In Docker and Kubernetes the database may start after the API. `server.js` retries the connection 10 times instead of crashing on the first attempt.

## 5. Structured JSON logs
Every log line is one JSON object (`time`, `level`, `msg`, `path`, `status`, `ms`). Log systems such as Loki can filter by field — e.g. all `status >= 500` in the last hour. Health-check requests are not logged, to keep noise down.

## 6. Minimal dependencies
The API uses Node's built-in `http` module; the only dependency is `pg`. Fewer packages mean a smaller image, faster builds and fewer vulnerabilities for the Trivy scan in phase 2.

## 7. Two stores, one interface
`MemoryStore` and `PostgresStore` expose the same methods. Tests run in milliseconds with no database; production uses PostgreSQL. The rest of the code never knows the difference.

## 8. Tests run with `npm test`
Six tests start the server on a random port and call it over HTTP, including validation and a path-traversal check. In phase 2 GitHub Actions will run exactly this command on every push — **if a test fails, nothing gets deployed**.

## 9. `package-lock.json` is committed
It pins the exact version of every dependency so CI, Docker and your laptop install the same thing.

### Check yourself
1. What is the difference between liveness and readiness?
2. Why does the app need to handle `SIGTERM`?
3. Where would you put the database password — and where never?
