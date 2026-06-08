# CLAUDE.md — MyAnalyst

AI-powered data-analysis web app: upload a spreadsheet → an instant, fully-explained dashboard (cleaning
report, KPIs, real statistics, forecasts, charts, plain-language insights, ask-your-data, exports). The
shippable app is **`apps/web`** (Next.js 15, App Router, Tailwind v4, npm), deployed to **Vercel from `main`**.

> **Name note:** product is **MyAnalyst** (was Quantia → Lumora). The **repo/folder is still `quantia`**, the
> package is `@quantia/web`, and `quantia:` localStorage keys are kept on purpose. Don't "fix" the mismatch.

## 🚧 Current initiative: pivot the analysis engine to Python

We are migrating the analysis engine from **in-browser TypeScript** to a **Python (pandas/statsmodels)
backend that does ALL the compute**, with an **LLM (Groq/Gemini) writing the conclusions** from the
computed facts. The full plan is **[`docs/06-python-migration.md`](docs/06-python-migration.md)** — read it
before doing pivot work.

- **Trade-off accepted by the owner:** data now leaves the browser to a server (the old "data never leaves
  the page" privacy moat is dropped); it needs server hosting.
- **Migration is ADDITIVE + STAGED. NEVER break the live site.** `main`/myanalyst.net keeps running on the
  **TypeScript** engine until the Python path reaches parity. Do Python/deploy-config work on the
  **`python-engine`** branch (Vercel preview), not `main`, until verified.
- **Hosting = Vercel Python Serverless Function** (`apps/web/api/analyze.py`), same project.

## Two engines, two toolchains

### TypeScript engine (LIVE — `apps/web/src/lib/`)
Pure, worker-safe modules → a `DashboardSpec`. The analysis quality lives in the **metric-semantics layer**
(`semantics.ts`) — internalize it; the Python port mirrors it:
- **Revenue vs cost vs attribute.** `revenueMetric` = top-line money (sales/amount/price-paid), **never
  cost/profit**. `isAdditive` = sum flows (revenue, units), **average** attributes (age, unit price, rating).
- **`isTransactionGrain`** (one row per sale) drives revenue/units and gates a lot of logic.
- **`detectDomain`** is structure-aware: `price`/`volume` are only *weak* financial hints; a transaction
  stream is **sales/operational, never a price-series**. (A `Price`/`Cost` column must NOT flip a sales file
  to "financial" — that bug disabled the whole revenue path.)
- KPIs lead with **Total revenue · Units · Avg sale · Revenue trend (monthly, partial month trimmed) · Gross
  margin · Top-seller share · Best month**, and **drop attribute noise** ("Average customer age"); keep
  rate/score averages (NPS, satisfaction) for surveys.
- Group-comparison "close the gap / copy the leader" advice is **suppressed** for unit-price metrics and
  product dimensions (`isValueTautology`) — never "make cheap cars cost like the expensive ones" — but
  **kept** for outcome×operational gaps (a region/rep lagging on revenue).
- Outliers are classified **skew segment** (use the median, no alarm) vs **isolated anomaly** (`outliers.ts`).

**Gates (run from `apps/web`):** `npm run typecheck` · `npx vitest run` · `npm run build` ·
`npx tsx scripts/smoke.mts` · `npx playwright test --workers=1` (the `--workers=1` avoids a transient
post-build flake). ~272 vitest + 7 E2E.

**Gotcha:** `deriveConclusions` in `conclusions.ts` is **NOT wired into the live pipeline**
(`analyze.ts` sets `conclusions: []`). Users read **`insights` (`insights/templated.ts`) + `actions`
(`actions.ts`)** — edit those for live output.

### Python engine (NEW — `apps/web/api/`)
`_engine.py` (pandas) ports the semantics + revenue-first KPIs + best-sellers; `analyze.py` is the
`/api/analyze` serverless route. Underscore-prefixed `.py` files are private (not routed by Vercel).
- **Use `py`, not `python`** on this Windows box (`python.exe` is the WindowsApps stub → exit 49).
  `py --version` = 3.14; pandas/numpy/scipy installed. Target deploy runtime is Vercel Python 3.12.
- **Run:** `py apps/web/api/_test_engine.py` (assertions) · `py apps/web/api/_demo.py` (car-sales demo).
- Engine computes deterministic **facts**; the LLM only narrates them (grounding discipline — it can't
  invent numbers).

## Conventions

- **Auto-commit & push after each working unit** — the owner views the deployed Vercel site, which only
  updates from pushed commits. Verify gates first. End commit messages with the `Co-Authored-By` trailer.
  **Exception:** Python/deploy-config changes go on the **`python-engine` branch** (preview), not `main`,
  until the pivot is verified — to protect the live site.
- **`Bash` cwd resets to the repo root after a `git` call** — `cd apps/web` (or `apps/web/api`) again before
  `npm`/`npx`/`py`. The CRLF "LF will be replaced" warnings on Windows are harmless.
- **LLM is optional and OFF by default**; the local templated engine runs with zero network calls. Provider
  = **Groq on a permanent FREE key** — never design for paid/high-volume LLM capacity; favor zero-API paths
  and graceful degradation under rate limits. Only metadata + computed numbers ever cross to the LLM, never
  raw rows.
- **Not financial advice:** every analysis surface must make clear the output is not financial/investment
  advice and to verify with a qualified professional.

## Pointers
- Plan of record for the pivot: **`docs/06-python-migration.md`**
- Python engine details: `apps/web/api/README.md`
- Original blueprint: `docs/01-architecture.md` … `docs/05-feature-catalog.md`
