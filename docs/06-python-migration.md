# 06 — Python Analysis Migration (plan of record)

**Goal:** move MyAnalyst's analysis engine from in-browser TypeScript to a **Python backend** that does all
the computation with best-in-class libraries (pandas, numpy, scipy, **statsmodels**, scikit-learn), and have
an **LLM (Groq/Gemini) write the conclusions** from the computed facts. Same pattern as the owner's
`CustomerBehaviour` and `Ethereum-Macro-Analysis` projects.

This document is the single source of truth for the migration. Update it as phases land.

---

## 0. Principles (do not violate)

1. **Never break the live site.** `main` → myanalyst.net stays on the TypeScript engine until the Python
   path is at **parity**. All Python/deploy work happens on the **`python-engine` branch** (Vercel preview)
   and merges to `main` only when verified.
2. **Additive, staged.** Each phase ships independently and is testable on its own.
3. **Facts are computed; the LLM only narrates.** Python returns deterministic numbers; the LLM turns them
   into conclusions and may not invent figures (grounding check). This is the core trust property.
4. **Privacy posture changed.** Data now leaves the browser to the server — say so in the UI, and never log
   raw rows server-side.
5. **Free Groq key forever.** Design conclusions to use few tokens, degrade gracefully under rate limits,
   and never depend on paid LLM capacity.

---

## 1. Target architecture

```
Browser (Next.js, apps/web)
  │  parse file client-side (papaparse / SheetJS), sample to stay < 4.5 MB
  │  POST /api/analyze   { csv | columns+rows, options }
  ▼
Vercel Python Function  apps/web/api/analyze.py   (pandas + scipy + statsmodels)
  │  → AnalysisSpec (JSON): profile, domain, kpis, charts(data), stats, bestSellers,
  │     trends, forecast, segments, correlations, outliers, facts[]
  ▼
Browser renders the spec  (existing ECharts + KPI cards)  ── instant, deterministic
  │  POST /api/conclude   { facts, domain, userContext }   (optional, opt-in)
  ▼
LLM (Groq gpt-oss / Gemini)  → grounded conclusions + action plan  ── verified against facts[]
```

- **Upload limit:** Vercel serverless request body is **4.5 MB**. The client samples/reduces before POSTing
  (the TS parser already does reservoir sampling). Phase 4b adds Vercel Blob for full large files if needed.
- **Function size:** Vercel Python functions cap at **~250 MB unzipped**. See §6 (Risks) — the core stack
  fits; scikit-learn is the swing factor.

---

## 2. The stats stack (use the best tool for each job)

| Capability | Library / function | Notes |
|---|---|---|
| DataFrame, typing, group-bys | **pandas**, numpy | `to_datetime`, `to_numeric`, `groupby`, `resample("MS")` |
| Correlation + significance + CI | **scipy.stats** `pearsonr`/`spearmanr` + Fisher-z CI | exact p-values, 95% CI |
| Regression / driver analysis | **statsmodels** `OLS` | coefficients, **p-values, CIs, R²/adjR², F-test**, standardized β |
| Multicollinearity | statsmodels `variance_inflation_factor` | flag redundant drivers |
| Group comparison (ANOVA) | statsmodels `ols`+`anova_lm` / scipy `f_oneway` | + **eta²**; Tukey HSD via `pairwise_tukeyhsd` |
| Two-group test | scipy.stats `ttest_ind(equal_var=False)` | Welch's t |
| Categorical association | scipy.stats `chi2_contingency` | + Cramér's V |
| Multiple-testing correction | statsmodels `multipletests(method="fdr_bh")` | Benjamini-Hochberg |
| Trend / decomposition | statsmodels `STL`, `seasonal_decompose`, `acf` | seasonality strength, ACF period |
| **Forecasting** | statsmodels **`ExponentialSmoothing`** (Holt-Winters), `SARIMAX` | native, with prediction intervals; optional `pmdarima.auto_arima` |
| Distribution / normality | scipy.stats `skew`, `kurtosis`, `jarque_bera`, `shapiro` | mean-vs-median honesty |
| Outliers | scipy (z, IQR) + skew classification | "skew segment" vs "anomaly" (port `outliers.ts`) |
| Segmentation (k-means) | **scipy.cluster.vq.kmeans2** (size-safe) or sklearn `KMeans`+`silhouette` | choose k by elbow/silhouette |
| Dimensionality (optional) | sklearn `PCA` | only if sklearn fits the bundle |
| Concentration (Pareto/Gini/HHI) | numpy (hand-rolled) | already ported |

**Default deployable stack:** `pandas, numpy, scipy, statsmodels`. Treat **scikit-learn as optional** (size
risk) — do clustering with `scipy.cluster.vq` so the core never needs it; enable sklearn only if the bundle
fits or via the Phase 4b service.

---

## 3. Module port map (TS → Python)

| TS (`apps/web/src/lib/`) | Python (`apps/web/api/`) | Library |
|---|---|---|
| `profile.ts` | `_engine.profile` ✅ | pandas |
| `semantics.ts` | `_engine` semantics ✅ | regex + pandas |
| `domain.ts` | `_engine.detect_domain` ✅ | regex + structure |
| `kpi.ts` | `_engine.compute_kpis` ✅ | pandas |
| `bestsellers.ts` | `_engine.best_sellers` ✅ | pandas + numpy(Gini) |
| `concentration.ts` | `concentration.py` | numpy |
| `charts.ts` | `charts.py` (returns data series, not ECharts opts) | pandas |
| `stats.ts` / `inference.ts` | `stats.py` | scipy + statsmodels |
| `timeseries.ts` | `timeseries.py` | pandas resample + statsmodels STL |
| `forecast.ts` (Holt-Winters) | `forecast.py` | **statsmodels ExponentialSmoothing** |
| `segment.ts` (k-means) | `segments.py` | scipy.cluster.vq |
| `outliers.ts` (skew vs anomaly) | `outliers.py` | scipy.stats |
| `relationships.ts`, `rfm.ts`, `cohort.ts` | `relationships.py`, `rfm.py`, `cohort.py` | pandas + scipy |
| `insights/templated.ts` | `insights.py` (fact builder) | pure |
| LLM narrator (`api/insights/route.ts`) | `api/conclude.py` | Groq/Gemini SDK |

---

## 4. Phases & deliverables

### Phase 1 — Engine PoC ✅ DONE
`_engine.py`: profiling, semantics, structure-aware domain, revenue-first KPIs (total revenue, units, avg
sale, monthly trend w/ partial-month trim, gross margin, top-seller share, best month), best-sellers.
`_test_engine.py` (8 asserts) + `_demo.py` green.

### Phase 2 — Full analysis parity  ⏳ NEXT
Port the rest so the spec matches the TS `DashboardSpec` facts:
- `charts.py` — monthly revenue line, **revenue & units by product** bar, forecast line, frequency, scatter,
  correlation heatmap (return `{type, title, x, series}` data; the frontend builds ECharts options).
- `stats.py` — correlations (scipy + FDR), **driver regression (statsmodels OLS** with β, p, R²),
  group comparison (ANOVA + eta² + Tukey), chi-square association, Welch t for dataset compare.
- `forecast.py` — **statsmodels ExponentialSmoothing** (auto seasonal period from ACF/STL), prediction band.
- `timeseries.py` — MoM/YoY, STL trend + seasonality strength.
- `segments.py` — k-means (scipy), describe clusters by defining z-features.
- `outliers.py` — skew-segment vs anomaly classification (+ root-cause breakdown).
- `concentration.py`, `rfm.py`, `cohort.py`, `relationships.py`.
- `insights.py` — build the grounded **facts[]** + a templated fallback narrative.
- Tests: extend `_test_engine.py`; add a parity script that runs the **same CSV** through TS (`scripts/smoke`)
  and Python and diffs KPI values/headline facts (tolerance for float noise).

### Phase 3 — AI conclusions
- `api/conclude.py`: take `facts[]` + domain + userContext → Groq (`gpt-oss-120b`, reasoning low/hidden) →
  **decision-first conclusions + prioritized action plan**. Reuse the consultant-grade prompt + the numeric
  **grounding verifier** (every figure must trace to a fact; flag any that don't). Gemini fallback. Always
  append the not-financial-advice disclaimer.
- Degrade to the templated narrative when the key is rate-limited / disabled.

### Phase 4 — Hosting & ingest
- `api/analyze.py` (✅ exists) verified on the **preview deploy** (pandas/scipy/statsmodels install < 250 MB).
- **4a:** confirm `vercel.json` builds the Python function alongside Next (add a `functions`/runtime entry if
  auto-detect fails); set `maxDuration` (Pro: up to 300 s) for big analyses.
- **4b (if needed):** Vercel Blob for >4.5 MB uploads (client → Blob → Python reads URL); or split a heavy
  `/api/analyze-heavy`. If the full stack (sklearn) won't fit, stand up a small **FastAPI** service instead
  and point the frontend at it.

### Phase 5 — Frontend wiring & cutover
- A thin client `lib/py-client.ts`: POST the parsed/sampled data to `/api/analyze`, receive the spec.
- A **feature flag** (`NEXT_PUBLIC_ENGINE=python|ts`): render the Python spec with the existing KPI cards +
  ECharts; keep the TS engine as fallback. Ship to preview, dogfood on real files.
- **Parity checklist** (below) must pass on a basket of sample files before flipping the default.
- Flip `NEXT_PUBLIC_ENGINE=python` on `main`; keep TS one release as rollback; then deprecate.

### Phase 6 — Beyond parity (Python-only wins)
SARIMAX/auto-ARIMA forecasting, proper OLS inference everywhere, STL seasonality, normality-aware
mean-vs-median, IsolationForest anomalies, larger datasets server-side, exportable Python "recipe".

---

## 5. The AnalysisSpec contract (JSON Python returns)

```jsonc
{
  "rowCount": 1500,
  "domain": { "domain": "sales-operational", "confidence": 0.95, "reason": "..." },
  "columns": [ { "name": "Price", "type": "currency", "role": "metric" } ],
  "kpis":   [ { "id", "name", "value", "trend?", "relevance", "howComputed" } ],
  "charts": [ { "id", "type", "title", "subtitle?", "x": [...], "series": [ { "name", "values" } ] } ],
  "bestSellers": { "dimension", "metric", "topRevenue", "topUnits", "byRevenue", "byUnits" },
  "stats": { "correlations": [...], "drivers": {...}, "groupComparisons": [...], "associations": [...] },
  "trends": [...], "forecast": {...}, "segments": {...}, "outliers": [...], "concentration": [...],
  "facts": [ { "id", "text", "value", "kind" } ]   // ← what the LLM concludes from
}
```
Keep field names aligned with the TS `DashboardSpec` so the frontend renders either engine.

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Function > 250 MB** (sklearn) | Core = pandas/numpy/scipy/statsmodels (~200 MB); cluster via `scipy.cluster.vq`; sklearn only if it fits, else Phase 4b FastAPI. **Verify on the first preview deploy.** |
| **4.5 MB upload cap** | Client samples before POST (reservoir, as today); Blob for full files (4b). |
| **Cold starts** (pandas import ~1–2 s) | Acceptable; keep the function warm-ish; show a progress state. |
| **Timeout on big data** | `maxDuration` (Pro 300 s); cap rows server-side; sample. |
| **Privacy regression** | Explicit UI notice; never persist/log raw rows; HTTPS only. |
| **LLM rate limits (free Groq)** | Templated facts always render; conclusions are additive + cached. |
| **Float divergence TS↔Python** | Parity script with tolerances; treat Python as source of truth post-cutover. |

---

## 7. Definition of done (parity checklist)

On a basket of sample files (car sales, e-commerce, finance OHLC, survey, marketing), the Python path must:
- [ ] pick the **same domain** and **same revenue metric** as the (fixed) TS engine;
- [ ] produce the **headline KPIs** (total revenue, units, avg sale, trend, margin, top-seller, best month)
      with values within float tolerance;
- [ ] **drop attribute noise** ("Average customer age") and keep rate/score averages for surveys;
- [ ] never call a sales file "financial"; never sum an attribute; never advise "raise the cheap product's
      price to the premium one";
- [ ] return charts that render with the existing ECharts components;
- [ ] write **grounded** conclusions (every figure traces to a fact);
- [ ] pass `_test_engine.py` + the parity script; the live site is unaffected until the flag flips.

---

## Run / verify

```bash
py apps/web/api/_test_engine.py     # engine assertions
py apps/web/api/_demo.py            # car-sales KPI demo
# TS gates (parity reference), from apps/web:
npm run typecheck && npx vitest run && npm run build && npx tsx scripts/smoke.mts
```
