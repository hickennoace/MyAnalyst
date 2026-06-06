# ADR 0001 — Foundational Decisions

Status: **Accepted** · Date: 2026-06-06

## Context
Building an autonomous, AI-powered financial/statistical analysis SaaS (a zero-skill Power BI / Tableau alternative) with a hard "zero data leaks" requirement.

## Decisions

### D1 — Monorepo with separated web / API / compute tiers
A pnpm-workspace monorepo holds `apps/web` (Next.js) and `apps/api` (FastAPI), with Python compute running as queue workers sharing the API codebase.
**Why:** one repo for shared contracts; independent scaling of the expensive compute tier; clear tier boundaries for security.

### D2 — Hybrid AI privacy model
Raw rows never leave our infrastructure. All numeric work runs locally in Python; only schema + aggregates reach a zero-retention cloud LLM via a single redaction-gated adapter.
**Why:** reconciles "zero data leaks" with high-quality LLM narratives. Keeps the LLM a *writer*, not a *calculator*, which also prevents number hallucination. Self-hosted mode remains a future option.

### D3 — Spec-driven dashboards
The backend emits a declarative JSON dashboard spec; the frontend renders it.
**Why:** decouples frontend/backend work; makes dashboards reproducible, versionable, and exportable.

### D4 — Postgres + Row-Level Security for tenancy
Hard isolation via RLS keyed on `tenant_id` set from the verified JWT, with an app DB role that cannot bypass RLS.
**Why:** defense in depth — even an app-layer bug can't leak cross-tenant data.

### D5 — Financial/time-series as the v1 domain
Start narrow, reusing proven metric/stat code from the sibling `JupyterProject` ETH notebook (CAGR, Sharpe/Sortino/Calmar, rolling correlation + significance, OLS, drawdown).
**Why:** fastest path to a credible vertical slice; generalize to other domains afterward.

## Consequences
- Slightly more upfront infra (queue, workers, object storage) than a monolith — justified by the compute profile.
- The metadata-only `InsightContext` schema is a hard constraint all insight features must respect.
- Frontend can build against the dashboard-spec contract before the engine is finished.
