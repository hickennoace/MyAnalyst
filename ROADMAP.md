# ROADMAP — MyAnalyst

> The goal: **the best data-analysis website in the world** — the place anyone can drop a spreadsheet and walk away with the analysis a senior analyst would have given them, in seconds, for free, with their raw data never leaving the browser.

This is a living document. It is ordered by **value × leverage**, grouped into phases. Each item lists *why it matters*, *where it lands in the codebase*, and a *done-when* bar. Keep the privacy invariant sacred throughout: **raw rows never leave the page; only metadata/aggregates may reach `/api/insights`.**

---

## Where we are today (baseline)

The shippable app (`apps/web`, Next.js 15) already does a lot, and does it well:

- **Pipeline:** `parse → clean → profile → detect domain → KPIs → stats → forecast → charts → insights → DashboardSpec → render`, pure-TS under `src/lib`, run in a Web Worker with real progress.
- **Ingestion:** CSV (streamed in a worker, ~1 GB via reservoir sampling), Excel (multi-sheet picker), JSON, SQLite/`.db` (multi-table picker), `.txt`.
- **Statistics:** descriptive stats, Pearson correlation with significance + CIs, OLS regression, multiple-regression driver analysis, one-way ANOVA, chi-square association, outlier (z-score) detection, naive forecast.
- **Ask-your-data:** a deterministic NL→computation engine (count, frequency, correlation, trend, ranking, aggregate, group-by) + an optional LLM "principal analyst" narrator that is **grounded in pre-computed numbers**, has **conversation memory**, **streams** token-by-token, and proposes **follow-ups**.
- **Output:** KPI cards, a chart library + custom chart builder, an "About this data" story, plain-language insights, PNG/PDF export, shareable read-only links, dark/light theme, error boundaries, a11y + SEO.
- **Quality bar:** `npm run typecheck`, `npm test` (vitest, 48 tests), `npm run build`, Playwright E2E, `scripts/smoke.mts`.

So the roadmap below is about going from *"a genuinely good free analyst"* to *"the one people tell their friends about."*

---

## Phase 1 — Make "Ask your data" unbeatable (highest leverage)

The Q&A box is the soul of the product. Three concrete gaps stand between it and best-in-world:

### 1.1 Filtered & conditional questions  ✅ DONE (2026-06-07)
Today the engine can aggregate a whole column or group-by, but it **cannot filter**. Real users constantly ask *"total revenue **in 2023**"*, *"average order value **for the North region**"*, *"how many orders **where status is cancelled**"*. 
- **Where:** `src/lib/query.ts` — add a `detectFilter(text, table, profiles)` that resolves a categorical value (match against each dimension's distinct values) or a time predicate (year/quarter/month, ranges like "after 2022", "between Jan and Mar"). Thread the filtered row-set through every answer branch (count, aggregate, ranking, trend) and into `buildFocalFacts` so the AI path narrates the *filtered* numbers too.
- **Done when:** unit tests cover value filters, year filters, range filters, and "X vs Y" comparisons; filtered facts appear in the evidence payload.
- **Shipped:** `detectFilter`/`applyFilter` in `query.ts` (exported) handle three filter kinds — categorical value (matched against each dimension's distinct values, with a stop-word guard), time/year (`in 2023`, `after 2022`, `before 2021`, `between 2021 and 2023`), and numeric comparison on a *named* metric (`over/under/at least/at most/between`). Every answer branch runs on the filtered view and weaves the scope into the prose; charts are built from the filtered view; the AI evidence payload carries a `scope` object and computes `buildFocalFacts` on the filtered subset (overview stays whole-dataset for contrast). A filtered suggestion chip surfaces the feature. 13 query tests (8 new) + full suite (56) green. **Still open for a follow-up:** explicit "X vs Y" comparison primitive (that's item **1.2**), and month/quarter granularity.

### 1.2 Comparison questions  ✅ DONE (2026-06-07)
*"Compare North vs South revenue"*, *"how does 2023 compare to 2022"*, *"electronics vs furniture margin"*. Build a small comparison primitive (two filtered slices → delta, ratio, % change, winner) and a paired bar/line chart.
- **Where:** `src/lib/query.ts` + `charts.ts`. **Done when:** the deterministic engine returns a two-series chart and a "$X vs $Y (+Z%)" sentence.
- **Shipped:** `detectComparison`/`answerComparison` in `query.ts` (exported) handle two-slice comparisons — two values of one dimension *or* two years on the time column — gated on a comparison signal (`vs`, `versus`, `compare(d)`, `difference between`, `against`) so it doesn't fire on plain filters, and run *before* the single-filter path so a "vs" question isn't collapsed to one side. It honors total-vs-average, emits the gap, % difference, multiple (×) and winner, and a paired bar via `buildComparisonChart` in `charts.ts`. Correctly defers a two-metric "revenue vs units" to the correlation branch. The AI evidence carries a `comparison` fact (each side's value, gap, %, ratio, higher) so the narrator stays grounded. 5 new tests (23 query tests; 61 total) + typecheck + build green. **Follow-up:** >2-way comparisons and month/quarter periods.

### 1.3 The AI picks the chart  ✅ DONE (2026-06-07)
Open-ended AI answers currently render **no chart** (charts only attach when the deterministic branch made one). Let the model emit a *constrained* chart request — `{type, x, y[], agg, filter?}` from a whitelist — which the server validates and the client builds with `buildChart`. Never let the model emit arbitrary ECharts; it only *chooses among* legal specs.
- **Where:** `route.ts` answer task (add a `chart` field to the JSON contract) + `query.ts` to validate & build. **Done when:** "what's driving revenue?" returns prose **and** a relevant, engine-built chart.
- **Shipped:** the non-streaming answer JSON now carries a `chart` field (`{type,x,y[],aggregate?,count?}`); the prompt teaches the model the chart conventions. `sanitizeChartRequest` in `query.ts` (exported, tested) validates the model's choice against a type whitelist and the dataset's real column names — dropping unknown columns and rejecting off-spec types, so the model only ever *chooses among legal specs* (never raw ECharts). `buildSuggestedChart` then builds it via `buildChart`, honoring any filter in the question so the chart matches scope. The **streaming path** carries prose only, so there it derives the chart locally from the question with the existing `parseChartRequest` (`nl-chart.ts`) — every AI answer, open-ended or streamed, now gets a relevant chart. 4 new tests (65 total) + typecheck + build green. **Note:** in the common streaming path the chart is locally-parsed, not model-chosen; emitting the model's chart over the stream (out-of-band trailer) is a possible future refinement.

### 1.4 Show the math (trust)  ✅ DONE (2026-06-07)
A collapsible "How I computed this" under every answer: the exact rows considered, the aggregation, the filter. This is the trust differentiator vs. ChatGPT-with-a-file (which hallucinates numbers). 
- **Where:** `QueryBox.tsx` + carry a `method` string on `QueryAnswer`.
- **Shipped:** every deterministic answer branch (count, frequency, correlation, trend, ranking, aggregate, bare-metric, comparison) now sets a plain-language `method` quoting the aggregation and the exact row basis via a shared `rowsNote()` helper ("N of M rows {scope}"). The AI path carries `base.method` through (the numbers are computed locally, so the account is accurate), and `QueryBox` renders it as a native `<details>` "How I computed this" disclosure under each answer. 3 new tests (68 total) + typecheck + build green.

### 1.5 Multi-step / agentic reasoning (stretch)
For genuinely hard questions ("which segment should we cut?"), let the LLM request *additional* aggregates from a fixed tool palette (group-by, filter, correlate) over 1–2 rounds before answering — still aggregates-only, still no raw rows. Cap rounds for cost.

---

## Phase 2 — Deeper analysis engine

Differentiate on *statistical substance*, not just charts.

- **2.1 Anomaly & outlier surfacing in the UI.** ✅ DONE (2026-06-07) — `detectAnomalies()` in `analyze.ts` exposes per-metric unusual values (|z|>3, strongest first) on `DashboardSpec.anomalies`; an `AnomalyCard` shows each with the typical range (mean ± std) and an above/below marker. 2 tests. (Follow-up: one-click "exclude & re-run".)
- **2.2 Segmentation / clustering.** ✅ DONE (2026-06-07) — `segmentRows()` in `lib/segment.ts`: a dependency-free, deterministic (seeded) k-means over z-standardized numeric columns, k chosen by an elbow, run on a capped sample for speed. Each segment is described by its defining features (▲ high / ▼ low vs the overall average). Surfaced as a `SegmentCard`. 3 tests.
- **2.3 Richer time series.** ✅ DONE (2026-06-07) — `analyzeTimeSeries()` in `lib/timeseries.ts` auto-detects cadence (daily…yearly) from the median gap, buckets a metric into periods, and computes period-over-period change, **year-over-year** when a full season is present, a trailing moving average, and best/worst periods. Surfaced as a `TimeTrendCard` (latest value, MoM/YoY badges, sparkline + MA overlay). 4 tests. (Follow-up: full seasonality decomposition + forecast confidence band.)
- **2.4 Cohort & retention** (when an entity id + time exist) — retention curves and cohort heatmaps; huge for SaaS/marketing datasets.
- **2.5 Driver analysis, explained.** ✅ DONE (2026-06-07) — the existing multiple-regression `DriverAnalysis` is now lifted onto `DashboardSpec.drivers` and rendered as a "What moves the needle" `DriverCard`: factors ranked by standardized effect (β) with direction bars, significance flags, model fit (R²), and the correlation-≠-causation caveat.
- **2.6 Data-quality scorecard.** ✅ DONE (2026-06-07) — `computeDataQuality()` in `lib/quality.ts` scores five weighted, plain-language checks (completeness, uniqueness, informative columns, value consistency, outlier levels) into a 0–100 health score + letter grade, each failing check carrying a concrete fix. Reuses the cleaning report + profiles (cheap, runs in the worker). Surfaced as a score-ring `QualityCard` in `DashboardView`. 3 tests.
- **2.7 Smarter domain packs.** ✅ DONE (2026-06-07) — `lib/domain-pack.ts` adds per-domain `domainFocus()` orientation and `domainSuggestions()` — example questions selected/phrased per domain (financial / sales / marketing / survey / generic) but grounded in the dataset's REAL columns so they execute. Wired into the Ask box (suggestions + focus subtitle). 3 tests. (Domain already steers KPI/chart selection upstream.)

---

## Phase 3 — Data in: meet users where their data is

- **3.1 Multi-table joins.** SQLite already exposes multiple tables; let users join them (auto-suggest keys by name/overlap) and analyze the result. Foundation for relational analysis.
- **3.2 More formats:** Parquet, TSV, Google Sheets URL, clipboard paste, and a "connect a public CSV URL."
- **3.3 Bigger-than-RAM, gracefully.** Current sampling is good; add column-store/streaming aggregation (e.g. via DuckDB-WASM, evaluate cost/bundle) so 10M-row files get *exact* answers, not sampled ones — still 100% client-side.
- **3.4 Schema memory.** Recognize a re-uploaded file shape and restore the user's column overrides, excluded columns, and saved questions.

---

## Phase 4 — Output & sharing that spreads the product

- **4.1 Live, interactive shared dashboards** (not just static read-only): the `/view` link keeps filters and the Ask box (read-only engine, no raw data in the URL — store the dataset in a user-chosen way, never server-side by default).
- **4.2 Narrative report export.** ✅ DONE (2026-06-07) — `buildExecutiveSummary()` in `lib/report.ts` synthesizes the whole analysis into a few grounded, plain-language paragraphs (what the data is + quality grade, headline KPIs, the key movement + its driver, the standout finding), rendered as an `ExecutiveSummary` card that leads the dashboard. Since the existing PDF/PNG export snapshots the dashboard, the report now opens with this narrative and includes every new analysis section (quality, trends, segments, drivers, anomalies). 1 integration test (runs the full pipeline). (Follow-up: a dedicated text-first multi-page PDF layout.)
- **4.3 Scheduled / refreshable analysis** for connected URLs (opt-in).
- **4.4 Embeddable charts** (iframe/snippet) with the MyAnalyst credit — organic distribution.
- **4.5 Presenter mode** — full-screen, swipeable insight cards for meetings.

---

## Phase 5 — Product polish & growth

- **5.1 Onboarding & sample datasets.** ✅ DONE (2026-06-07) — the landing hero's "Try a live sample" CTA deep-links to `/analyze?demo=1`, which auto-runs a freshly-generated demo dataset (each seeded with realistic mess so cleaning/stats have work to do). Now **nine** generators spanning all detected domains — sales, SaaS, e-commerce, marketing, HR, real-estate, fitness, and new **survey** + **finance** sets so the domain packs are all demoable. 1 test.
- **5.2 Guided tour** of a generated dashboard the first time.
- **5.3 Mobile-first dashboard layout** ✅ DONE (2026-06-07, ongoing) — all new cards (executive summary, quality, trends, segments, drivers, anomalies) use responsive grids that collapse to single-column on mobile; the new animated elements (quality ring, driver bars) now honor `prefers-reduced-motion`. (Ongoing: deeper small-screen tuning of charts + data table.)
- **5.4 Accessibility to AAA** on the core flow; full keyboard nav for chart builder and Ask box.
- **5.5 i18n** — start with RTL + Hebrew (the team's context), framework for more.
- **5.6 Performance budget** — keep TTI low; lazy-load ECharts and heavy libs; measure with Lighthouse in CI.
- **5.7 Privacy as a feature, loudly.** ✅ DONE (2026-06-07) — a `PrivacyBadge` in the analyzer header: a green "Private" pill with a popover explaining the whole engine runs in your browser (file never uploaded; works offline after load), and that with AI on only anonymous aggregates — never raw rows — are sent. (Follow-up: live network-activity counter as extra proof.)

---

## Phase 6 — Platform & trust (longer horizon)

- **6.1 Optional accounts** (the `account/` route exists) for saving dashboards/history across devices — *encrypted, opt-in, raw data stays client-side or client-encrypted.*
- **6.2 Team workspaces** & comments on insights.
- **6.3 Model routing & failover** via Vercel AI Gateway (already on the stack) — cost tracking, provider fallback, so the AI layer is robust and cheap.
- **6.4 Public API / CLI** for the analysis engine (it's pure TS — could ship as an npm package).
- **6.5 Evals & guardrails for the AI** — a regression suite of (dataset, question, expected-grounded-number) cases so the LLM narrator can never silently drift off the real numbers.

---

## Cross-cutting principles (apply to every item)

1. **Privacy is the product.** Raw rows never leave the browser. Only aggregates/metadata reach `/api/insights`. Any new feature must preserve this — if it can't, it doesn't ship.
2. **Grounded, never hallucinated.** Every number the AI states must be computed by the engine or be a transparent arithmetic derivation of engine numbers. Expand the grounding evals as the AI grows.
3. **Graceful degradation.** The LLM is optional and off by default; everything must work (with real numbers) on the local heuristic/templated path alone.
4. **Add behind the seams.** New analysis lands as a pure module under `src/lib` against the `types.ts` contracts; UI consumes it via the existing component pattern.
5. **Always green.** `npm run typecheck`, `npm test`, `npm run build`, and Playwright stay passing; new engine logic ships with unit tests.
6. **No new paid deps without asking.** Evaluate bundle-size and cost before adding anything.

---

## Suggested next 3 (if you just want to start)

1. **1.1 Filtered questions** — biggest single jump in what the Q&A can answer; pure-TS + unit-testable.
2. **1.3 AI picks the chart** — makes open-ended AI answers visual; small, contained change.
3. **2.6 Data-quality scorecard** — high-perceived-value, reuses the cleaning report, great for the landing demo.
