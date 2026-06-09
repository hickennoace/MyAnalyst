# MyAnalyst

> **Autonomous financial & statistical analysis platform.** An AI-powered, zero-skill-required alternative to Power BI / Tableau. Upload data → get a clean, beautiful, fully-explained analytical dashboard with KPIs, statistics, forecasts, and plain-language insights — automatically.

---

## What it does

1. **Ingest** — Excel, CSV, JSON, or a live SQL connection. No mapping, no config.
2. **Clean & normalize** — automated typing, deduplication, missing-value handling, outlier flagging, unit/currency normalization — all without user intervention.
3. **Understand** — the engine profiles the schema and infers the *domain* (financial vs. operational vs. marketing, etc.).
4. **Auto-KPIs** — it proposes and computes the KPIs that matter for that domain.
5. **Auto-statistics** — it picks the right tools (regression, time-series forecasting, correlation, anomaly detection) and explains each one in friendly, non-condescending language.
6. **AI insights** — it writes real, actionable, plain-language conclusions grounded in the numbers.
7. **Secure by design** — bulletproof auth, encryption at rest + in transit, Row-Level Security tenant isolation, and a hardened, attack-resistant deployment.

## Repository layout

```
myanalyst/
├── README.md                 ← you are here
├── docs/                     ← the blueprint: architecture, tech stack, security, roadmap, features
│   ├── 01-architecture.md
│   ├── 02-tech-stack.md
│   ├── 03-security-privacy.md
│   ├── 04-mvp-roadmap.md
│   ├── 05-feature-catalog.md
│   └── adr/                  ← architecture decision records
├── apps/
│   ├── web/                  ← Next.js frontend (Vercel)
│   ├── pyapi/                ← LIVE Python compute service (pandas · statsmodels · scikit-learn), own Vercel project
│   └── api/                  ← FastAPI backend — target architecture for scale (Postgres RLS, workers)
├── packages/
│   └── shared/               ← shared schemas/types contracts across web & api
├── ml/                       ← models, prompt templates, experiment notebooks
├── infra/                    ← docker, compose, IaC, CI/CD
└── scripts/                  ← dev & ops helper scripts
```

## The core architectural idea (Python compute + grounded AI)

All numeric crunching — cleaning, KPIs, regression, time-series forecasting, correlation, segmentation, anomaly detection — runs **server-side in the Python engine** (`apps/pyapi`, built on pandas · statsmodels · scikit-learn). The engine computes deterministic **facts**; the LLM narrator only ever **writes prose over numbers the engine already produced**, so it can't invent a figure. Only **schema, column statistics, and small aggregates** are sent to the LLM — never the underlying records. See [docs/03-security-privacy.md](docs/03-security-privacy.md).

## Status

🟢 **Live at [myanalyst.net](https://myanalyst.net).** Upload a CSV/Excel file → instant auto-generated dashboard (auto-typed columns, domain detection, revenue-first ranked KPIs, real statistics, forecasts, auto-charts, grounded plain-language insights) + an "ask your data" analyst and an on-demand "generate a graph" builder.

The app is a **Next.js front end (`apps/web`)** backed by a **Python compute service (`apps/pyapi`)** — its own Vercel project at `quantia-api.vercel.app`, called cross-origin. The Python engine (pandas/statsmodels) does **all** the analysis; the LLM (Groq/Gemini, optional and off by default) only narrates the computed facts, and falls back to grounded templated text when no key is set. See [apps/web/README.md](apps/web/README.md).

The heavier blueprint below (FastAPI compute tier, Postgres RLS, Redis workers, multi-tenant SaaS) remains the target architecture for scale. Start with [docs/04-mvp-roadmap.md](docs/04-mvp-roadmap.md).

## Quick links

| Doc | What's inside |
|-----|---------------|
| [Architecture](docs/01-architecture.md) | System blueprint, components, data flow, sequence diagrams |
| [Tech Stack](docs/02-tech-stack.md) | Every chosen technology and *why* |
| [Security & Privacy](docs/03-security-privacy.md) | Auth, encryption, RLS, hardening, compliance |
| [MVP Roadmap](docs/04-mvp-roadmap.md) | Step-by-step build order from empty repo to launch |
| [Feature Catalog](docs/05-feature-catalog.md) | Everything that makes this a "beast" — present & future |
