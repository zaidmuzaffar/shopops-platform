# Phase 1 — Docker

The whole stack now runs with one command: `docker compose up -d --build`.

```
 your Mac :8080 ──▶ web (Nginx, non-root) ──/api──▶ api (Node, non-root, read-only) ──▶ db (PostgreSQL)
                    only open port                  not exposed                          not exposed, data in a volume
```

## 1. Multi-stage build (`app/api/Dockerfile`)
Three stages: **deps** (production packages), **test** (runs `npm test`) and **runtime** (what ships). The final image contains only `node_modules`, `package.json` and `src/` — no tests, no dev tools, no npm cache. Smaller image = faster pulls, fewer vulnerabilities.
Run the tests inside Docker with: `docker build --target test app/api`.

## 2. Layer caching
`package*.json` are copied and installed **before** the source code. Docker reuses that layer until dependencies change, so a code edit rebuilds in seconds instead of re-downloading every package.

## 3. Non-root containers
- API runs as the built-in `node` user (`USER node`).
- Web uses `nginx-unprivileged`, which runs as user 101 and listens on 8080 (only root may bind ports below 1024).
If an attacker breaks into the app, they are not root inside the container.

## 4. Hardening in `compose.yaml`
- `read_only: true` — the API cannot write to its own filesystem (only `/tmp` in memory).
- `no-new-privileges` — processes cannot gain extra privileges.
- `init: true` — a tiny init process forwards `SIGTERM` and cleans up child processes.

## 5. Network isolation
Only **web** publishes a port (8080). The API and database have no `ports:` — they are reachable only on the private Compose network, by service name (`api`, `db`). The browser talks to Nginx; Nginx forwards `/api/` to `http://api:3000`.

## 6. Health checks and start order
- `db` is healthy when `pg_isready` succeeds; `api` waits for it (`condition: service_healthy`).
- `api` is healthy when `/healthz` answers; `web` waits for it.
`docker compose ps` shows `(healthy)` next to each service.

## 7. Data in a named volume
PostgreSQL stores data in the `db-data` volume. `docker compose down` removes containers but keeps the data; `docker compose down -v` deletes it too. Containers are disposable — volumes hold the state.

## 8. Secrets via `.env`
The password lives in `.env` (ignored by Git). `.env.example` shows which variables are needed. If `.env` is missing, Compose stops with a clear error instead of starting with an empty password.

### Check yourself
1. Why copy `package.json` before the source code in a Dockerfile?
2. The API has no `ports:`. How does the browser still reach it?
3. What is the difference between `docker compose down` and `docker compose down -v`?
