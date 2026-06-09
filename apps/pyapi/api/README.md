# MyAnalyst — Python analysis engine (migration in progress)

We're moving the analysis engine from in-browser TypeScript to **Python (pandas/numpy/scipy)**, with an
LLM (Groq/Gemini) writing the conclusions from the computed facts — the same pattern as the
`CustomerBehaviour` and `Ethereum-Macro-Analysis` projects.

This is an **additive, staged migration**: the live site (myanalyst.net) keeps running on the TypeScript
engine until the Python path reaches parity, then we switch. The site never breaks mid-migration.

## Why (and the trade-off we accepted)

- **Pro:** rigorous, standard stats (pandas/scipy/statsmodels), big-data ready, conclusions by AI.
- **Con we accepted:** data now leaves the browser to a server (the old "data never leaves the page"
  privacy moat is dropped), and it needs a backend (hosting cost).

## Status

| Phase | What | State |
|---|---|---|
| **1. Engine PoC** | profiling · metric **semantics** (revenue vs cost vs attribute) · **structure-aware domain** · revenue-first **KPIs** (total revenue, units, avg sale, monthly trend, **gross margin**, **top-seller share**, best month) · **best-seller** story | ✅ done — `engine.py`, 8 tests green |
| 2. Rest of the analysis | charts data · correlations · trends · forecast (Holt-Winters / scipy) · k-means segments · skew-vs-anomaly outliers · templated insight facts | ⏳ next |
| 3. LLM conclusions | feed the computed facts to Groq/Gemini → decision-first conclusions + grounding check | ⏳ |
| 4. Hosting | Vercel Python Function (`/api/analyze`) **or** a small FastAPI service; upload handling (Vercel's 4.5 MB request-body limit → sample client-side or use Blob) | ⏳ |
| 5. Frontend + cutover | call the Python API, render the JSON spec with the existing ECharts/KPI cards behind a flag → reach parity → switch default | ⏳ |

## What it already does right (parity with the fixed TS engine)

On car-sales data it leads with **Total revenue · Transactions · Gross margin · Revenue YoY ·
Top Brand share · Avg sale · Best month** — and it does NOT: treat price as a stock series, sum customer
age, call a sales file "financial", or pad the KPIs with `Average CustomerAge`.

## Layout (Vercel Python Function)

Lives in the Vercel deploy root (`apps/web`) so it ships as a serverless function:

| File | Role |
|---|---|
| `analyze.py` | the **`/api/analyze`** route — `POST {csv}` or `{columns, rows}` → analysis spec (JSON) |
| `_engine.py` | the pandas engine (underscore = private module, not a route) |
| `_demo.py`, `_test_engine.py` | dev only (underscore = not routed) |
| `requirements.txt` | Vercel installs these for the function (pandas/numpy/scipy) |

Vercel routes `/api/*.py` to Python functions; Next.js keeps `app/api/*` — they don't collide.
Note Vercel's **4.5 MB request-body limit**: the frontend will sample large files before POSTing.

## Run it (local)

```bash
py apps/web/api/_demo.py        # smart KPIs on synthetic car-sales data
py apps/web/api/_test_engine.py # assertions (domain, revenue≠cost, margin, no-noise KPIs)
```

Requires `pandas numpy scipy` (`pip install -r apps/web/api/requirements.txt`).

## Design notes

- **`engine.analyze(df) -> dict`** returns a JSON-serializable spec (domain, columns, kpis, bestSellers)
  the web frontend renders. The engine computes deterministic FACTS; the LLM only narrates them (so it
  can't invent numbers — same grounding discipline as the TS engine).
- The semantics layer is the heart of it: `revenue_metric` (top-line money, never cost), `is_additive`
  (sum flows, average attributes), `is_transaction_grain`, `detect_domain` (price/volume are only weak
  financial hints; a transaction stream is sales/ops, never a price series).
