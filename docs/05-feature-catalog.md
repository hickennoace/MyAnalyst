# 05 — Feature Catalog

What makes MyAnalyst a *beast* for everyday use. Organized by tier so you can see the MVP line clearly.

## Tier 0 — MVP (must-have for v1)
- Upload CSV/Excel; automated clean + normalize with a transparent **cleaning report**.
- Schema profiling + domain detection.
- Auto-KPIs for the financial domain.
- Correlation, regression, and one forecast — each with a plain-language explanation.
- Grounded AI insight narratives.
- Beautiful auto-generated dashboard (spec-driven).
- Bulletproof auth + RLS tenant isolation.

## Tier 1 — Fast-follow (rounds out the product)
- **JSON ingestion** + **live SQL connections** (read-only, encrypted creds, SSRF-guarded).
- **More domains**: sales/operational, marketing, SaaS metrics — each with its own KPI & stat rule set.
- **Anomaly detection** (IsolationForest / z-score) with alerting.
- **More statistics**: logistic regression, clustering/segmentation, seasonality decomposition, hypothesis tests (t-test/ANOVA) with friendly explanations.
- **Multi-file / join detection**: recognize relatable datasets and suggest joins.
- **Export & share**: PDF/PNG, scheduled email reports, read-only share links.
- **Scheduled refresh** for SQL-connected datasets.

## Tier 2 — Differentiators (the "wow")
- **Ask-your-data (NL Q&A)**: type "why did revenue drop in Q3?" → the engine runs the analysis locally and the LLM narrates the result (metadata-only). Backed by pgvector over dataset profiles.
- **Automated narrative reports**: a full written "analyst report" PDF generated from the dashboard.
- **What-if / scenario modeling**: adjust an input, see KPIs and forecasts recompute.
- **Goal tracking & alerts**: set a KPI target; get notified on drift or breach.
- **Smart data-quality score** per dataset with fix suggestions.
- **Benchmarking**: compare a KPI against anonymized aggregates or user-provided baselines (the notebook's ETH-vs-BTC-vs-NASDAQ pattern, generalized).
- **Auto-insight digest**: a daily/weekly "here's what changed and why" email.

## Tier 3 — Platform & enterprise
- **Collaboration**: comments, annotations, shared workspaces, mentions.
- **Dashboard editing**: let power users tweak the auto-layout (drag/drop, pin charts) without losing the "auto" default.
- **Templates & themes**: branded dashboards, white-label.
- **API & embeds**: programmatic access; embed dashboards in other apps.
- **Connectors**: Google Sheets, Airtable, Stripe, QuickBooks, Postgres/MySQL/Snowflake/BigQuery.
- **SSO/SAML, audit exports, SOC 2 report** for enterprise buyers.
- **Self-hosted / air-gapped insight mode** (vLLM + open model) for regulated customers.
- **Mobile-friendly / PWA** dashboards.

## Cross-cutting quality features
- **Explainability everywhere**: every number links to "how was this computed?".
- **Confidence & caveats**: stats results show sample size, p-values, and honest "not enough data" warnings — never overclaim.
- **Undo / dataset versioning**: re-run analyses on prior versions.
- **Accessibility** (WCAG) and i18n (note: the sibling project already ships a Hebrew README — RTL support is on the radar).

## Prioritization heuristic
Ship Tier 0 → validate with real messy files → add Tier 1 connectors/domains (broadens market) → invest in Tier 2 Q&A (the headline differentiator) → Tier 3 when you have paying teams asking for it.
