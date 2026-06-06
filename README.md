# Quantia

> **Autonomous financial & statistical analysis platform.** An AI-powered, zero-skill-required alternative to Power BI / Tableau. Upload data → get a clean, beautiful, fully-explained analytical dashboard with KPIs, statistics, forecasts, and plain-language insights — automatically.

> ⚠️ **Project name is a placeholder.** Rename `quantia` everywhere if you pick a different brand.

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
quantia/
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
│   └── api/                  ← FastAPI backend (data crunching: pandas, scikit-learn, statsmodels)
├── packages/
│   └── shared/               ← shared schemas/types contracts across web & api
├── ml/                       ← models, prompt templates, experiment notebooks
├── infra/                    ← docker, compose, IaC, CI/CD
└── scripts/                  ← dev & ops helper scripts
```

## The core architectural idea (Hybrid AI)

To honor the "zero data leaks" requirement, **raw rows never leave your infrastructure**. All numeric crunching (cleaning, KPIs, regression, forecasting) runs locally in the Python backend. Only **schema, column statistics, and small aggregates** are sent to a cloud LLM to generate insight narratives — never the underlying records. See [docs/03-security-privacy.md](docs/03-security-privacy.md).

## Status

🟢 **Working MVP in `apps/web`** (Vercel-first). A live Next.js app: upload a CSV/Excel file → instant auto-generated dashboard (auto-typed columns, domain detection, ranked KPIs, statistics, auto-charts, grounded plain-language insights) + an on-demand "generate a graph" builder (plain-English or manual). The full analysis engine runs **client-side in the browser** — no backend, no API key, no data leaves the page. The insight narrator is behind a pluggable `InsightProvider` interface so a cloud/self-hosted LLM can drop in later with no UI changes. See [apps/web/README.md](apps/web/README.md).

The heavier blueprint below (FastAPI compute tier, Postgres RLS, Redis workers, multi-tenant SaaS) remains the target architecture for scale; the Vercel-first MVP is the fast path to a usable product today. Start with [docs/04-mvp-roadmap.md](docs/04-mvp-roadmap.md).

## Quick links

| Doc | What's inside |
|-----|---------------|
| [Architecture](docs/01-architecture.md) | System blueprint, components, data flow, sequence diagrams |
| [Tech Stack](docs/02-tech-stack.md) | Every chosen technology and *why* |
| [Security & Privacy](docs/03-security-privacy.md) | Auth, encryption, RLS, hardening, compliance |
| [MVP Roadmap](docs/04-mvp-roadmap.md) | Step-by-step build order from empty repo to launch |
| [Feature Catalog](docs/05-feature-catalog.md) | Everything that makes this a "beast" — present & future |
