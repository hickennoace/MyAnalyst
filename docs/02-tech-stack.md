# 02 — Tech Stack

Each choice lists the pick, the role, and *why* over the obvious alternatives.

## Frontend

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript** | SSR for marketing/SEO, RSC for fast app shell, huge ecosystem; deploys natively to Vercel. |
| Hosting | **Vercel** | Zero-config Next.js, edge network, preview deploys per PR. |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, consistent, accessible primitives; easy to theme for "beautiful by default". |
| Charts | **ECharts** (primary) + **visx/Recharts** for bespoke | ECharts handles large series, financial charts (candles, drawdown), and is fully driven by a JSON spec — perfect match for our declarative dashboard spec. |
| State/data | **TanStack Query** + **Zustand** | Server-cache + light client state; no Redux boilerplate. |
| Realtime | **SSE** (job progress), WebSocket if bidirectional later | Simple, proxy-friendly streaming of pipeline progress. |
| Tables | **TanStack Table** | Virtualized, sortable data grids for the cleaning preview. |

## Backend (API tier)

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | **FastAPI (Python 3.12) + Pydantic v2** | Async, typed, auto OpenAPI; same language as the compute tier (no model duplication). |
| Server | **Uvicorn behind Gunicorn** (or `uvicorn --workers`) | Production ASGI. |
| Validation | **Pydantic v2** | Request/response contracts shared conceptually with `packages/shared`. |
| ORM/DB access | **SQLAlchemy 2.0 + Alembic** | Mature, async-capable, migrations. RLS enforced at the DB, app sets `SET app.tenant_id`. |
| Auth lib | see Security doc | — |

## Compute / Data Science tier

| Concern | Choice | Why |
|---------|--------|-----|
| Task queue | **Celery** (or **Dramatiq**) on **Redis** | Battle-tested distributed workers; retries, scheduling, routing. Dramatiq if you want simpler ergonomics. |
| Dataframes | **pandas** (+ **Polars** for big files) | pandas for breadth/compat; Polars when files get large (lazy, multicore). |
| Columnar I/O | **PyArrow / Parquet** | Compact, typed working sets in object storage. |
| Embedded OLAP | **DuckDB** | SQL-speed aggregations over Parquet inside the worker — no warehouse needed for MVP. |
| Classic ML | **scikit-learn** | Regression, clustering, anomaly (IsolationForest), preprocessing. |
| Statistics | **statsmodels** + **scipy.stats** | OLS with inference, p-values, confidence intervals, hypothesis tests. |
| Forecasting | **statsforecast** / **Prophet** | Fast classical forecasting (ARIMA/ETS) + easy seasonal models. |
| Validation | **pandera** | Declarative dataframe schemas → trustworthy cleaning gates. |
| Profiling | custom + ideas from **ydata-profiling** | Per-column stats feeding domain detection. |

## AI / LLM tier (Hybrid strategy)

| Concern | Choice | Why |
|---------|--------|-----|
| Insight LLM | **Anthropic Claude** (zero-retention) — provider-abstracted | Strong structured-output + reasoning for grounded narratives. Abstract behind an interface so you can swap providers or self-host. |
| Structured output | **Tool/JSON-schema mode** | Force the model to return validated insight objects, not prose to parse. |
| Domain classify | small/fast model or rules | Cheap, runs on metadata only. |
| Privacy boundary | **metadata + aggregates only** | Raw rows never sent. See architecture §5. |
| Optional self-host | **vLLM + Llama/Qwen** | Path to fully air-gapped insights if a customer demands it. |
| Embeddings (later) | local embedding model | For semantic "ask your data" Q&A over the dataset's profile. |

> All LLM access goes through one `insights/llm_client.py` adapter so the provider, retention policy, and the metadata-only redaction layer are enforced in exactly one place.

## Database & storage

| Concern | Choice | Why |
|---------|--------|-----|
| Primary DB | **PostgreSQL 16** | RLS for tenant isolation, JSONB for dashboard specs, rock-solid. |
| Managed option | **Supabase** or **Neon** / RDS | Supabase bundles Postgres + Auth + RLS + storage; Neon for serverless branching. |
| Object storage | **S3 / R2 / Supabase Storage** | Encrypted raw uploads + Parquet + assets, per-tenant prefixes. |
| Cache/broker | **Redis** | Queue broker + cache + rate-limit counters. |
| Search (later) | **pgvector** | Semantic search over dataset profiles for the Q&A feature. |

## Infrastructure & DevOps

| Concern | Choice | Why |
|---------|--------|-----|
| Containers | **Docker** | Reproducible API + worker images. |
| Local dev | **docker-compose** | Postgres + Redis + MinIO + API + worker + web in one command. |
| Orchestration | **Fly.io / Render / Railway** (MVP) → **Kubernetes** (scale) | Start simple; graduate to k8s when worker autoscaling matters. |
| Frontend | **Vercel** | As above. |
| IaC | **Terraform** | Reproducible cloud infra once past MVP. |
| CI/CD | **GitHub Actions** | Lint, type-check, test, build images, deploy. |
| Secrets | **Doppler / cloud secret manager** | No secrets in env files in prod. |
| Observability | **OpenTelemetry + Grafana/Tempo/Loki** or **Sentry + Datadog** | Traces across tiers, error tracking, per-stage metrics. |

## Language/tooling baseline

- **Python**: `uv` or Poetry for deps, `ruff` (lint+format), `mypy`, `pytest`.
- **TypeScript**: `pnpm`, `eslint`, `prettier`, `vitest`/`playwright`.
- **Monorepo**: pnpm workspaces for JS; the Python apps are independent packages under `apps/api` and worker shares its code.

## Why this stack fits the requirements

- **Zero-skill UX** → Next.js + shadcn + ECharts render a polished dashboard from a spec, no user config.
- **Heavy crunching** → Python compute tier with the exact libraries the notebook already proves out.
- **Zero leaks** → single LLM adapter + RLS Postgres + encrypted object storage define a tight trust boundary.
- **One language across API + compute** → Pydantic models and domain logic aren't duplicated.
