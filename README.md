# ShopOps Platform

**A production-style DevOps platform for a small inventory app — built step by step, the way a platform team would.**

> 🎫 **PLAT-101 · Priority: High**
> The inventory team deploys by hand: SSH into a server, `git pull`, restart. Every release causes downtime, there is no monitoring, and secrets live in the code.
> **Goal:** an automated, secure and observable platform. Every push is tested, built and deployed with zero downtime. If something breaks, an alert fires and a rollback is one click away.

The application itself is deliberately small. The interesting part is everything around it.

📖 Full write-up with screenshots and lessons learned: **[ShopOps case study](https://zaidmuzaffar.github.io/projects/shopops-platform.html)**

---

## Architecture

```
 Developer ── pull request ──▶ GitHub Actions (CI)
                                 ├─ test → build → Trivy scan → push image to GHCR (main only)
                                 └─ terraform fmt → validate → plan (AWS via OIDC, no stored keys)
             merge to main
                   │
                   ▼
 Argo CD (GitOps) ── sync ──▶ Kubernetes (k3d, local)
                                 Traefik ingress (localhost:8081)
                                  ├─ web   Nginx × 3
                                  ├─ api   Node.js, 2–5 pods (autoscaled on CPU)
                                  └─ db    PostgreSQL StatefulSet + persistent volume
                                           daily pg_dump backups (CronJob) + restore test

 Prometheus ── scrapes api /metrics every 30 s, evaluates 4 alert rules ──▶ Grafana dashboard

 Terraform ──▶ AWS: VPC (2 AZs, no NAT gateway) · tiered security groups ·
               S3 state with locking · GitHub OIDC role · budget alerts
```

## Roadmap

| Phase | What | Status |
|---|---|---|
| 0 | App, repository layout, tests | ✅ |
| 1 | Docker: multi-stage, non-root images, docker-compose | ✅ |
| 2 | CI: GitHub Actions — tests, build, Trivy scan, push to GHCR | ✅ |
| 3 | Terraform + AWS: VPC, security groups, S3 state, GitHub OIDC (read-only CI role), budgets | ✅ |
| 4 | Kubernetes: k3d, Helm chart, ingress, probes, autoscaling, disruption budgets | ✅ |
| 5 | GitOps with Argo CD: auto-sync, prune, self-heal, rollback by `git revert` | ✅ |
| 6 | Observability: `/metrics`, Prometheus, Grafana dashboard, alert rules | ✅ |
| 7 | Security & reliability: backups, TLS, secrets, k6 load test | 🚧 in progress |
| 8 | Docs: architecture, runbook, incident postmortem, cost report | ⏳ |

Every finished phase is tagged (`phase-0` … `phase-6`). Open a tag on GitHub to see the repository exactly as it was at that point.

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
| GET | `/metrics` | Prometheus metrics — requests, latency, memory, CPU, version |

**Configuration** (environment variables only)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | *(empty)* | PostgreSQL URL. Empty = in-memory store |
| `WEB_DIR` | *(empty)* | Serve the web UI from this folder (local development) |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `APP_VERSION` | from `package.json` | Version shown by `/api/version` |

## Run with Docker (recommended)

```bash
cp .env.example .env          # then set a password in .env
docker compose up -d --build  # db + api + web
docker compose ps             # all three should show (healthy)
```

Open **http://localhost:8080**. Logs: `docker compose logs -f api`. Stop: `docker compose down` (data is kept).

| Image | Base | Runs as | Notes |
|---|---|---|---|
| `shopops-api` | `node:22-alpine` | `node` | multi-stage, read-only filesystem |
| `shopops-web` | `nginx:stable-alpine-slim` (official, made non-root) | uid 101 | serves UI, proxies `/api` |

## Run on Kubernetes (k3d)

Needs Docker, [k3d](https://k3d.io), `kubectl` and `helm`. Everything runs on your machine.

```bash
# 1. Local cluster (1 server + 1 agent), ingress on localhost:8081
k3d cluster create shopops --agents 1 -p "8081:80@loadbalancer"

# 2. Build the images and load them into the cluster (no registry needed)
docker build -t shopops-api:0.5.0 app/api
docker build -t shopops-web:local app/web
k3d image import shopops-api:0.5.0 shopops-web:local -c shopops

# 3. Namespace, Sealed Secrets, and the database password sealed for YOUR cluster
#    (the value in values.yaml opens only on the cluster it was sealed for; letters and numbers only)
kubectl create namespace shopops
helm repo add sealed-secrets https://bitnami.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system --version 2.22.0 \
  --set-string fullnameOverride=sealed-secrets-controller
echo -n 'changeme123' | kubeseal --raw --namespace shopops --name shopops-db
#    -> put the printed value into db.sealedPassword in k8s/helm/shopops/values.yaml (in your fork)

# 4. Monitoring stack (the chart ships a ServiceMonitor, alert rules and a dashboard for it)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace \
  --set alertmanager.enabled=false --set prometheus.prometheusSpec.retention=2d

# 5. Argo CD, then hand the app to it: from now on the cluster follows the main branch
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl -n argocd wait --for=condition=Available deployment --all --timeout=300s
kubectl apply -f argocd/shopops-app.yaml
```

Open **http://localhost:8081**. Without Argo CD, install the chart directly: `helm install shopops k8s/helm/shopops -n shopops` (add `--set monitoring.enabled=false` if step 4 was skipped).

**Monitoring.** Grafana: `kubectl -n monitoring port-forward svc/monitoring-grafana 3001:80`, then open http://localhost:3001 (user `admin`, password from `kubectl -n monitoring get secret monitoring-grafana -o jsonpath="{.data.admin-password}" | base64 -d`). The dashboard is **ShopOps / API (RED)**.

| Alert | Fires when | Severity |
|---|---|---|
| `ShopOpsApiUnavailable` | no API pod is reachable for 2 minutes | critical |
| `ShopOpsApiHighErrorRate` | more than 5% of requests fail (5xx) for 5 minutes | warning |
| `ShopOpsApiSlow` | p95 latency is above 500 ms for 10 minutes | warning |
| `ShopOpsBackupMissing` | no successful database backup for 26 hours | warning |

**Secrets.** The database password is in Git only as a SealedSecret: encrypted with the cluster's public key and opened only by the Sealed Secrets controller inside the cluster. Back up the controller's private key somewhere safe outside Git (`kubectl -n kube-system get secret -l sealedsecrets.bitnami.com/sealed-secrets-key -o yaml`): without it, the sealed password cannot be opened after a cluster rebuild.

**Backups.** A CronJob runs `pg_dump` every day at 08:00 UTC and keeps the newest 7 dumps on their own volume, which neither Helm nor Argo CD will ever delete. A backup only counts once it has been restored, so the chart also ships a restore test: it restores the newest dump into a scratch database and compares row counts.

```bash
kubectl -n shopops create job --from=cronjob/db-backup backup-now           # back up now
kubectl -n shopops create job --from=cronjob/db-restore-test restore-test   # prove it restores
kubectl -n shopops logs job/restore-test                                    # ends with RESTORE TEST PASSED
```

## Run without Docker

```bash
cd app/api
npm install
npm test                          # 11 tests
WEB_DIR=../web npm start          # http://localhost:3000  (in-memory store)
```

With a real PostgreSQL:

```bash
docker run -d --name shopops-db -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=shopops -p 5432:5432 postgres:16-alpine
DATABASE_URL=postgres://postgres:devpass@localhost:5432/shopops WEB_DIR=../web npm start
```

## Repository layout

```
app/api           Inventory API + tests + Dockerfile
app/web           Web UI + Nginx config + Dockerfile
compose.yaml      Local stack (db, api, web)
.github/          CI workflow: tests, image builds, Trivy scan, Terraform plan
infra/            Terraform for AWS (phase 3)
k8s/base/         Plain Kubernetes manifests with Kustomize (phase 4)
k8s/helm/shopops  Helm chart, alert rules and Grafana dashboard (phases 4–6)
argocd/           Argo CD application (phase 5)
docs/             Phase notes; runbook and postmortem come in phase 8
```

## Author

**Zaid Muzaffar** — Cloud & DevOps Engineer · [zaidmuzaffar.github.io](https://zaidmuzaffar.github.io) · [LinkedIn](https://www.linkedin.com/in/zaid-muzaffar-57329237a/)
