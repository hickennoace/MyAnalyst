# 04 — MVP Roadmap

The goal of the MVP: **a logged-in user uploads a CSV/Excel file and, minutes later, sees a clean, beautiful, auto-generated dashboard with KPIs, at least two statistical analyses, and plain-language insights — with hard tenant isolation.**

Cut everything not on that path for v1. SQL connections, forecasting depth, Q&A, sharing — all come after.

## Guiding principles
- **Vertical slice first**: get one file end-to-end before adding breadth.
- **Pick ONE domain for v1**: financial/time-series data (you already have proven code for it in the sibling notebook). Generalize later.
- **Spec-driven dashboards**: backend emits a JSON dashboard spec; frontend renders it. This decouples the two teams from day one.
- **Security from line one**: RLS and the LLM trust boundary are not "later" — they're in the first migration and the first LLM call.

---

## Phase 0 — Foundations (repo & infra) ✅ scaffolded here
- [x] Monorepo skeleton (`apps/web`, `apps/api`, `packages/shared`, `ml`, `infra`).
- [ ] `docker-compose` for Postgres + Redis + MinIO + API + worker + web.
- [ ] CI: lint (ruff/eslint), type-check (mypy/tsc), test, build images.
- [ ] `.env.example` + secrets via Doppler in non-local.
- [ ] Base FastAPI app (health check, settings, logging) + base Next.js app (shell, theme).

## Phase 1 — Identity & tenancy
- [ ] Integrate managed auth (Supabase Auth / Clerk): register, login, email verify, reset, MFA toggle.
- [ ] Tenants + users + memberships tables; RBAC roles.
- [ ] **Postgres RLS** on all tenant tables; app sets `app.tenant_id` from verified JWT.
- [ ] **Tenant-isolation test** (A cannot read B) — must pass before anything else ships.
- [ ] Protected app shell in the frontend (auth-gated routes).

## Phase 2 — Ingestion & storage
- [ ] Presigned-upload flow: client → object storage (encrypted), API records dataset metadata.
- [ ] File parsing worker: CSV + Excel → typed dataframe → **Parquet** working set. (JSON next.)
- [ ] Dataset list/detail endpoints + UI; upload progress.
- [ ] File-safety guards: size/row caps, type validation, formula-injection scan.

## Phase 3 — Cleaning & profiling (the moat)
- [ ] Cleaning worker: type inference, date/currency/number normalization, dedupe, missing-value handling, trailing-total/merged-header detection, outlier flagging.
- [ ] **Cleaning report** artifact (what changed and why) + before/after preview UI (TanStack Table).
- [ ] Schema profiler: per-column stats (type, cardinality, distribution, PII flag, semantic role).
- [ ] Domain detection (start with rules + a metadata-only LLM classify) → label the dataset's domain.

## Phase 4 — KPI engine (financial domain v1)
- [ ] Port from the sibling notebook: returns, CAGR, volatility, Sharpe/Sortino/Calmar, drawdown, MoM/YoY.
- [ ] KPI rule registry keyed by domain + column roles; rank by relevance; compute values + trends.
- [ ] KPI cards in the dashboard spec.

## Phase 5 — Statistics & forecasting engine
- [ ] Correlation analysis (Pearson + significance) — reuse notebook code.
- [ ] Linear/OLS regression with `statsmodels` (coefficients, R², p-values) + auto target/feature selection heuristics.
- [ ] One forecasting method (`statsforecast` ARIMA/ETS) for time-series.
- [ ] Each result ships with a **plain-language "what this is / what it found"** block (templated; LLM polishes the wording from the numbers only).

## Phase 6 — AI insights
- [ ] `llm_client.py` adapter with the **metadata-only `InsightContext`** schema + redaction gate + zero-retention provider.
- [ ] Structured-output insight objects (claim, supporting numbers, confidence, recommended action), ranked.
- [ ] Grounding guard: every insight must cite a number the engine computed (reject ungrounded claims).

## Phase 7 — Dashboard assembly & rendering
- [ ] Dashboard spec schema in `packages/shared` (KPI cards, chart blocks, narrative blocks, layout).
- [ ] Spec assembler in the worker; persist spec as JSONB.
- [ ] Frontend renderer: ECharts charts + KPI cards + insight narrative, "beautiful by default" theme.
- [ ] Job-progress streaming (SSE): user watches "Cleaning… KPIs… Insights…".

## Phase 8 — Polish & launch-readiness
- [ ] Export (PDF / PNG / shareable read-only link, tenant-scoped).
- [ ] Empty/error/loading states; onboarding sample dataset.
- [ ] Rate limits, quotas, audit log, Sentry.
- [ ] Security checklist in [03-security-privacy.md](03-security-privacy.md) §12 fully green.
- [ ] Closed beta with a handful of real users + real messy files.

---

## Suggested build order for a solo dev / small team
1. **Phase 0 + 1** (foundations + auth/RLS) — get the security spine right.
2. **Phase 2 + 3** (ingest + clean) — the unglamorous core that makes the rest trustworthy.
3. **One vertical slice through 4→7** with a *single* hard-coded financial dataset, to see a real dashboard render.
4. Then generalize KPI/stats rules and harden (Phase 8).

## Definition of done for the MVP
A new user signs up, uploads a messy financial CSV, watches the pipeline run, and gets a dashboard with: a cleaning report, ≥4 relevant KPIs, a correlation matrix, a regression with explanation, a forecast, and ≥3 grounded plain-language insights — while a second tenant provably cannot see any of it.
