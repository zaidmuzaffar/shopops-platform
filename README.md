# ShopOps Platform

**A production-style DevOps platform for a small inventory app — built step by step, the way a platform team would.**

> 🎫 **PLAT-101 · Priority: High**
> The inventory team deploys by hand: SSH into a server, `git pull`, restart. Every release causes downtime, there is no monitoring, and secrets live in the code.
> **Goal:** an automated, secure and observable platform. Every push is tested, built and deployed with zero downtime. If something breaks, an alert fires and a rollback is one click away.

The application itself is deliberately small. The interesting part is everything around it.

---

## Target architecture

```
 Developer ──push──▶ GitHub ──▶ GitHub Actions (CI)
                                 lint → test → build → Trivy scan → push image (GHCR)
                                                          │
                                         image tag bump ──▼
                                 Argo CD (GitOps) ──sync──▶ Kubernetes (k3s)
                                                            ├─ web (Nginx)
 Terraform ──▶ AWS: VPC · subnets · security groups ·       ├─ inventory-api (autoscaled)
               IAM · GitHub OIDC · budget alerts            └─ PostgreSQL
                                                            ▲
                    Prometheus + Grafana + Alertmanager ────┘
```

## Roadmap

| Phase | What | Status |
|---|---|---|
| 0 | App, repository layout, tests | ✅ |
| 1 | Docker: multi-stage, non-root images, docker-compose | ⏳ |
| 2 | CI: GitHub Actions — tests, build, Trivy scan, push to GHCR | ⏳ |
| 3 | Terraform + AWS: VPC, IAM least privilege, GitHub OIDC, budgets | ⏳ |
| 4 | Kubernetes: k3d/k3s, Helm chart, ingress, probes, autoscaling | ⏳ |
| 5 | GitOps CD with Argo CD, one-click rollback | ⏳ |
| 6 | Observability: Prometheus, Grafana, alerts | ⏳ |
| 7 | Security & reliability: TLS, secrets, backups, k6 load test | ⏳ |
| 8 | Docs: architecture, runbook, incident postmortem, cost report | ⏳ |

## The app

| Part | Tech | Path |
|---|---|---|
| Inventory API | Node.js (no framework), PostgreSQL | `app/api` |
| Web UI | HTML, CSS, JavaScript | `app/web` |

**API**

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/products` | List products |
| POST | `/api/products` | Create `{ name, category, price, quantity }` |
| GET / PATCH / DELETE | `/api/products/:id` | Read / update / delete one product |
| GET | `/api/version` | Running version |
| GET | `/healthz` | Liveness — the process is alive |
| GET | `/readyz` | Readiness — the app can serve traffic (database reachable) |

**Configuration** (environment variables only)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | *(empty)* | PostgreSQL URL. Empty = in-memory store |
| `WEB_DIR` | *(empty)* | Serve the web UI from this folder (local development) |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `APP_VERSION` | from `package.json` | Version shown by `/api/version` |

## Run locally

```bash
cd app/api
npm install
npm test                          # 6 tests
WEB_DIR=../web npm start          # http://localhost:3000  (in-memory store)
```

With a real PostgreSQL:

```bash
docker run -d --name shopops-db -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=shopops -p 5432:5432 postgres:16-alpine
DATABASE_URL=postgres://postgres:devpass@localhost:5432/shopops WEB_DIR=../web npm start
```

## Repository layout

```
app/api     Inventory API + tests
app/web     Web UI
infra/      Terraform (phase 3)
k8s/        Helm chart and manifests (phase 4)
.github/    CI/CD workflows (phase 2)
docs/       Phase notes, architecture, runbook, postmortem
```

## Author

**Zaid Muzaffar** — Cloud & DevOps Engineer · [zaidmuzaffar.github.io](https://zaidmuzaffar.github.io) · [LinkedIn](https://www.linkedin.com/in/zaid-muzaffar-57329237a/)
