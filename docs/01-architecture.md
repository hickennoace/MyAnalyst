# 01 — System Architecture Blueprint

## 1. Design goals

| Goal | Architectural consequence |
|------|---------------------------|
| Zero technical skill required | Everything after "upload" is automated; no config screens, no formula language. |
| Beautiful output, automatically | A theming/layout engine renders dashboards from a declarative spec the backend emits. |
| Heavy data crunching | A dedicated Python compute tier (pandas / scikit-learn / statsmodels) separated from the web tier. |
| Zero data leaks | Raw data stays inside our trust boundary; only metadata/aggregates ever reach an external LLM. |
| Multi-tenant SaaS | Hard tenant isolation via Row-Level Security + per-tenant object-storage prefixes. |
| Long-running jobs | Async task queue + workers; the API never blocks on a 2-minute regression. |

## 2. High-level component map

```
                        ┌────────────────────────────────────────────────┐
                        │                   CLIENT (browser)              │
                        │   Next.js (Vercel) — dashboards, upload, auth    │
                        └───────────────┬──────────────────────────────────┘
                                        │ HTTPS (JWT / session cookie)
                                        ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │                      EDGE / API GATEWAY                            │
        │   TLS termination · WAF · rate limiting · auth verification        │
        └───────────────┬──────────────────────────────────────────────────┘
                        │
            ┌───────────┴────────────┐
            ▼                        ▼
 ┌─────────────────────┐   ┌──────────────────────────────────────────────┐
 │   FastAPI (API)     │   │   Auth service (Clerk/Supabase Auth or self)  │
 │  - REST + SSE/WS    │   │   - login/register, MFA, sessions, RBAC        │
 │  - request/response │   └──────────────────────────────────────────────┘
 │  - enqueues jobs    │
 └─────────┬───────────┘
           │ enqueue
           ▼
 ┌─────────────────────┐        ┌──────────────────────────────────────────┐
 │  Task queue (broker)│◄──────►│  COMPUTE WORKERS (Python)                  │
 │  Redis + Celery/    │        │  Pipeline stages:                          │
 │  RQ / Dramatiq      │        │   1. Ingestion & parsing                   │
 └─────────────────────┘        │   2. Cleaning & normalization              │
                                │   3. Schema profiling & domain detection   │
                                │   4. KPI engine                            │
                                │   5. Statistics & forecasting engine       │
                                │   6. Insight generation (LLM, metadata only)│
                                │   7. Dashboard spec assembler              │
                                └───────┬───────────────────┬────────────────┘
                                        │                   │
                  ┌─────────────────────▼──┐   ┌────────────▼─────────────────┐
                  │  PostgreSQL (+ RLS)     │   │  Object storage (S3-compat)   │
                  │  - tenants, users       │   │  - raw uploads (encrypted)    │
                  │  - datasets metadata    │   │  - parquet working sets       │
                  │  - dashboards, jobs     │   │  - generated chart assets     │
                  │  - audit log            │   └──────────────────────────────┘
                  └─────────────────────────┘
                                        │ metadata + aggregates ONLY
                                        ▼
                          ┌────────────────────────────────┐
                          │  LLM provider (zero-retention)  │
                          │  insight narratives, KPI naming  │
                          └────────────────────────────────┘
```

## 3. The tiers

### 3.1 Web tier (Next.js / Vercel)
- Server-rendered marketing + app shell; client-rendered interactive dashboards.
- Talks only to the API gateway; holds no DB credentials.
- Streams job progress via Server-Sent Events / WebSocket so the user watches the pipeline ("Cleaning… Detecting KPIs… Writing insights…").
- Renders charts from the **declarative dashboard spec** the backend returns (chart type, encodings, data refs, narrative blocks).

### 3.2 API tier (FastAPI)
- Thin, fast, async. Validates requests (Pydantic), enforces authz, reads/writes metadata, and **enqueues** heavy work. It does *not* run regressions inline.
- Exposes: auth, dataset upload (presigned URLs), connection management, job status, dashboard retrieval, export.

### 3.3 Compute tier (Python workers)
The heart of the product. A staged pipeline (see §4) running on workers pulled from the queue. CPU/RAM-heavy and horizontally scalable independently of the API.

### 3.4 Data tier
- **PostgreSQL** — relational source of truth, with **Row-Level Security** policies keyed on `tenant_id` for hard isolation. Stores metadata, not bulk data.
- **Object storage (S3-compatible)** — raw uploads + columnar working sets (Parquet) + generated assets. Encrypted, per-tenant prefixes.
- **Redis** — task broker + ephemeral cache (profiles, session rate-limit counters).
- **DuckDB** (embedded in workers) — fast local OLAP over Parquet for aggregations without a heavyweight warehouse.

## 4. The automated analysis pipeline (the magic)

Each uploaded dataset flows through these stages. Each stage is idempotent, logged, and emits structured artifacts so the pipeline is resumable and auditable.

| # | Stage | Input | Output | Key libs |
|---|-------|-------|--------|----------|
| 1 | **Ingestion** | raw file / SQL cursor | normalized tabular frame → Parquet | `pandas`, `openpyxl`, `pyarrow`, SQLAlchemy |
| 2 | **Cleaning & normalization** | raw frame | typed, deduped, imputed frame + cleaning report | `pandas`, `pandera` (validation) |
| 3 | **Schema profiling & domain detection** | clean frame | per-column profile (type, cardinality, distribution, semantic role) + inferred domain | `ydata-profiling`-style stats + LLM classify (metadata only) |
| 4 | **KPI engine** | profile + domain | ranked list of computed KPIs with values & trends | rule library + `pandas` |
| 5 | **Statistics & forecasting** | clean frame + profile | regression / correlation / forecast / anomaly results, each with a plain-language "what this means" | `scikit-learn`, `statsmodels`, `prophet`/`statsforecast`, `scipy` |
| 6 | **Insight generation** | stats results + KPI values (aggregates only) | ranked textual conclusions, grounded & cited to the numbers | LLM (zero-retention), structured output |
| 7 | **Dashboard assembler** | KPIs + stats + insights | declarative dashboard spec (JSON) | internal spec builder |

> **Cleaning is the moat.** Real files are messy: mixed date formats, currency symbols, thousands separators, merged header rows, trailing totals, inconsistent casing. Stage 2 must be relentless and produce a transparent *cleaning report* the user can trust.

### Domain detection drives everything
Stage 3's inferred domain (e.g. *financial time-series*, *sales/operational*, *survey*) selects which KPI rules (Stage 4) and which statistical tools (Stage 5) are appropriate. Financial data → returns, volatility, Sharpe, drawdown, MoM/YoY. Operational data → throughput, conversion, cohort retention, funnel.

### Reuse from the existing notebook
The ETH analysis notebook in the sibling `JupyterProject` already contains production-grade implementations of: CAGR, rolling volatility, Sharpe/Sortino/Calmar, rolling Pearson correlation with significance testing, OLS alpha/beta, and drawdown analysis. These port directly into the **financial KPI rule set** (Stage 4) and the **statistics engine** (Stage 5).

## 5. Insight generation — how raw data stays home

```
clean frame ──► [Stats engine, LOCAL] ──► numeric results
                                          (R², coef, p-values, forecast points,
                                           KPI values, top correlations)
                                                  │
                                                  ▼  serialize a COMPACT, AGGREGATE-ONLY context
                                          { "domain": "financial",
                                            "kpis": [{name, value, trend}],
                                            "regression": {target, r2, top_drivers},
                                            "anomalies": [{date, zscore}] }   ← NO raw rows
                                                  │
                                                  ▼
                                          LLM (zero-retention) ──► narrative insights
```
The LLM is a *writer*, not a *calculator*. It never sees PII or raw records — only the small statistical summary the local engine produced. This is the linchpin of both privacy and correctness (the model can't hallucinate numbers it was handed).

## 6. Async job lifecycle

```
POST /datasets (presigned upload) → 202 + job_id
        │
        ├─ worker picks job → runs stages 1..7, writing progress to Redis/DB
        │
client subscribes: GET /jobs/{id}/stream (SSE) → "stage: cleaning 40%"...
        │
        └─ on完成: dashboard spec persisted → client GET /dashboards/{id}
```

## 7. Scaling & reliability notes
- **API and workers scale independently** — workers are the expensive tier; autoscale on queue depth.
- **Backpressure**: queue depth + per-tenant concurrency caps prevent one big upload from starving others.
- **Idempotency keys** on uploads; **dataset versioning** so re-runs don't clobber history.
- **Observability**: structured logs, OpenTelemetry traces across API→queue→worker→LLM, per-stage timing metrics.

See [02-tech-stack.md](02-tech-stack.md) for concrete technology choices and [03-security-privacy.md](03-security-privacy.md) for the trust-boundary details.
