# MyAnalyst — Roadmap to surpass myAnalyst Pro

> **Goal:** the analysis a $2k/mo operator-BI consultant gives a chain — delivered **instantly, for any data, privately, by AI**, with no integration project and no login.

Living roadmap — updated 2026-06-08.

---

## 1. Who we're beating, and how

**myanalystpro.com** is a *vertical B2B operator-BI platform* for multi-unit chains (Jiffy Lube, Midas, Bojangles…): it **integrates** with POS / QuickBooks / payroll, shows **live cross-location dashboards + benchmarking + alerts**, ships **industry modules** (AutoCare, CarWash, QSR…), and sells a **human-written monthly consultant report** ("Pro"). Strengths: deep operational data, benchmarking, managed consulting, trust with chains. Weaknesses: needs integration projects, a sales motion, humans in the loop, and only serves a few verticals.

**We don't clone them.** We win a different, winnable game and out-execute on the things AI now does better than humans + integrations:

| Where they're strong | How **MyAnalyst** beats it |
|---|---|
| Integrations consolidate data daily | **Zero setup** — drop any file (or paste a URL) and get analysis in seconds. No IT project. |
| Human consultant writes a monthly report | **Instant AI "action report"** — ranked, specific recommendations in seconds, for *any* dataset, any time. |
| Live KPI dashboards | **Auto dashboard + an AI analyst you can ask anything**, grounded in the real numbers. |
| Location benchmarking | **Compare any two datasets** (period vs period, A vs B, vs a benchmark) self-serve. |
| Off-track alerts | **Refreshable sources + anomaly alerts** (opt-in). |
| Industry modules | **Domain auto-detection + vertical templates**, no configuration. |
| Enterprise trust | **Privacy as the moat** — the engine runs in your browser; raw data never leaves the page. A chain can use it without a data-sharing agreement. |

**Positioning one-liner:** *"Upload a spreadsheet, get the report a consultant charges thousands for — in seconds, and your data never leaves your browser."*

---

## 2. Where we already lead (shipped)

The product is already deep and live at **myanalyst.net**:

- **Ingest:** CSV (streamed ~1GB), Excel (multi-sheet), JSON, SQLite (multi-table), TSV/TXT, **public CSV URL**, **multi-table joins**.
- **Auto-pipeline:** clean/normalize → **data-quality scorecard** → profile → domain detect → KPIs → stats → charts → insights → story → **executive summary**.
- **Real statistics:** regression w/ inference, correlation (FDR-corrected), ANOVA, chi-square, **multiple-regression driver analysis**, **anomaly detection**, **k-means segmentation**, **time-series MoM/YoY + moving averages**, **cohort retention**, forecasting.
- **Ask your data (the edge):** plain-English Q&A grounded in real numbers — filters, comparisons, smart "most-X-by-Y" intent, AI-picked charts, "show the math", and an **LLM query-planner so you can ask almost anything** (the model plans the computation; the engine runs it locally → exact + private).
- **Output:** auto charts + NL chart builder, PNG/PDF export, shareable read-only links, dark/light, a11y, **privacy badge**.
- **Quality bar:** 123 unit tests, Playwright E2E, smoke, grounding evals.

We are already *broader and more intelligent on arbitrary data* than their self-serve surface. The roadmap closes the few gaps where they still feel more "complete" for an operator.

---

## 3. The plan (prioritized)

Each item says **why it beats them** and **done-when**. ✅ = done.

**Progress (2026-06-08): every client-side item is shipped.** A1–A3, B1 (+B2 via the report), C1, D1, D2, D4 are live on myanalyst.net. Only the two backend-dependent items (C2, D3) remain — they need a go/no-go on a small opt-in backend. Build state: 129 unit tests, Playwright E2E, smoke — all green.

### Phase A — Intelligence (the moat: "ask anything, get a real answer") ✅
- **A1. LLM query-planner** ✅ — ask almost any question; AI plans, engine computes locally. **Beats:** their canned dashboards can't answer free-form questions.
- **A2. Multi-step / diagnostic reasoning** ✅ — the deep findings (regression drivers, trends, the ranked actions) are computed up front and fed into Ask-your-data, so "why did X / what should I do" answers are grounded in the regression/ANOVA/trend analysis. **Beats:** what their *human* consultant does — automated.
- **A3. Resilience & cost** ✅ — lean prompts; per-dataset Q&A cache (repeat questions are instant, no extra LLM call); graceful throttle fallback to the (correct) heuristic.

### Phase B — The instant "action report" (counters their paid Pro tier) ✅
- **B1. Ranked action report** ✅ — `lib/actions.ts` builds up to 5 *prioritized, quantified* actions (biggest group gap sized as "worth ~$X", the strongest driver/lever, declining trend, concentration risk, data-quality fix), each grounded and ranked by impact. Surfaced as "Your action plan" near the top of the dashboard and in the exported report.
- **B2. Report polish** ✅ *(covered)* — the action plan + executive summary now lead the existing branded PDF/PNG export, so the report reads like a consultant deliverable. (A dedicated text-first multi-page PDF layout remains a future nicety.)

### Phase C — Benchmarking & monitoring, self-serve (their operational edge)
- **C1. Compare two datasets** ✅ — a "⇄ Compare" button uploads a second file; `compareDatasets()` ranks shared metrics by the size of the change (Δ total + Δ avg + row delta). **Beats:** their cross-location benchmarking, for any files, no integration.
- **C2. Refreshable sources + alerts** ◐ *(needs a small opt-in backend — your go/no-go)* — connect a URL/Sheet, auto-refresh on a schedule, alert when a metric goes off-track. **Blocked on the backend decision** (§4).

### Phase D — Reach, trust & polish
- **D1. More sources** ✅ — Google Sheets URL (CSV export) + paste-from-spreadsheet. (Parquet still pending a bundle-cost decision.)
- **D2. Vertical starter templates** ✅ — pick-your-industry samples (retail / SaaS / e-commerce / marketing / HR / real-estate / fitness / survey / finance), zero config.
- **D3. Optional encrypted accounts** ◐ *(opt-in backend — your go/no-go, §4)* — save dashboards/sources across devices, client-encrypted.
- **D4. Presenter mode** ✅ + **perf** ✅ (ECharts already lazy-loaded). Guided first-run tour / AAA a11y / i18n-RTL remain minor follow-ups.

---

## 3b. Next wave — staying ahead (added 2026-06-08)

> Phases A–D took us to parity-plus on the self-serve surface. This wave is about **out-thinking** them: the analyses a senior consultant *actually* does by hand, more rigor than a dashboard ever shows, and reach into where data really lives — **all without breaking the 100%-client-side / privacy-first line.** Ordered by value × leverage. Each item is buildable as a pure `src/lib` module + a dashboard card unless noted.
>
> **Status (2026-06-08): Wave 2 COMPLETE — every item E–I is shipped & live, including the two heavy-dependency ones (G1 ingest, I2 on-device model) after the go-all-of-them call.** Test suite 144→164 unit tests, all green; typecheck + build + smoke pass.

### Phase E — Consultant-grade analysis (the biggest unmatched value) ✅
- **E1. Contribution / mix-shift decomposition** ✅ — `lib/contribution.ts` + "What drove the change" card: attributes the primary metric's period-over-period move to a dimension; per-segment deltas sum to the total, plus mix-shift (share gained/lost). **Done.**
- **E2. What-if scenario simulator** ✅ — `DriverAnalysis.model` now carries the fitted coefficients + baselines; `lib/scenario.ts` + ScenarioCard project the target from sliders with a modelled range. **Done.**
- **E3. Goal-seek / target planner** ✅ — `goalSeek()` inverts the same model; enter a target change → ranked, in-range-flagged lever moves. **Done.**
- **E4. Root-cause drill-down on anomalies** ✅ — `detectAnomalies` attributes anomalous rows to the segment they cluster in (lift = outlier-share ÷ base-share), shown on the Anomalies card. **Done.**
- **E5. Open-text & survey analytics** ✅ — `lib/text-analytics.ts` + Themes & sentiment card: bigram-preferring keyword themes with representative quotes + lexicon sentiment. **Done.**

### Phase F — Rigor as the moat (trust beats features) ✅
- **F1. Significance everywhere** ✅ — forecast chart draws a 95% prediction interval (widens with horizon); dataset compare runs Welch's t-test per metric ("real" vs "n.s."); small-sample state surfaced. **Done.**
- **F2. Caveat propagation** ✅ — `lib/caveats.ts` flows the data-quality findings into a "read with care" strip + a ⚠ on any KPI derived from a flagged column. **Done.**
- **F3. Methodology appendix + reproducible recipe** ✅ — `lib/methodology.ts` + MethodologyCard: methods/assumptions/limitations (incl. the not-financial-advice disclaimer) kept in the export, a deterministic fingerprint, and a downloadable `.recipe.json`. **Done.**

### Phase G — Reach without a backend ✅
- **G1. Meet data where it lives** ✅ — Parquet (hyparquet, pure-JS), PDF-table extraction (pdf.js positioned text), and image/OCR (tesseract.js) ingest, all dynamically imported so they only load on use. PDF + OCR share the pure, unit-tested `lib/table-extract.ts` reconstruction core. **Done.**
- **G2. Install & offline (PWA) + mobile polish** ✅ — web manifest (installable, maskable icon), service worker (network-first navigations + stale-while-revalidate assets, never caches `/api`), production registrar; analyzes data with no network once cached. **Done.**
- **G3. Privacy-preserving "refresh" without our servers** ✅ *(shipped earlier — Google Sheet/URL re-fetch + local re-analyze).*

### Phase H — The deliverable ✅
- **H1. Text-first multi-page PDF** ✅ — `lib/report-pdf.ts` composes a paginated, selectable consultant report (cover, exec summary, metrics, actions, findings, methodology) directly with jsPDF — not a screenshot. **Done.**
- **H2. White-label / branded export** ✅ — `lib/brand.ts` + BrandEditor: name, accent, logo (local-only) applied to the report, deck, and image-export header. **Done.**
- **H3. Auto-generated slide deck** ✅ — `exportDeckPdf` turns the spec into a landscape readout deck (cover + key-findings/actions/metrics slides + notes). **Done.**

### Phase I — Optional AI depth (privacy intact) ✅
- **I1. Bring-your-own-key LLM** ✅ — `lib/llm-settings.ts` + AiKeyEditor: a user's own provider key (stored locally, off by default) threaded through the analyzer to the narrator; the `/api/insights` route prefers a per-request BYOK key over the env and never persists it. Metadata-only context unchanged. **Done** — BYOK is now threaded through the Ask-your-data planner and answer calls too (`query.ts` sends `byok: activeLlmConfig()`), so a user's own key powers every AI surface.
- **I2. In-browser LLM (WebGPU / transformers.js)** ✅ — `lib/local-llm.ts` runs Qwen2.5-0.5B-Instruct in-browser via WebGPU; opt-in toggle, lazy-loaded (weights cached after first download), zero network at inference. After analysis the page sharpens the story locally and degrades silently if WebGPU/model is unavailable. **Especially valuable on the free Groq tier — uses no API quota.** **Done.**

---

## 3e. The only remaining roadmap work is a product decision (not buildable without your call)

Every client-side, privacy-preserving item across Waves 1–4 is now shipped. The **only** items left in this roadmap are the two that deliberately cross the "100%-client-side / raw rows never leave the browser" line — they can't be built without changing the product's core privacy promise, so they need an explicit go/no-go from you, not a guess:

- **C2 — Managed alerts / scheduled refresh** (a small opt-in backend that re-fetches a source on a schedule and emails when a metric goes off-track). **G3 already delivers most of this value** (re-fetch a Google Sheet/URL and re-analyze locally) without a server.
- **D3 — Optional encrypted cloud accounts** (save dashboards/sources across devices, client-encrypted). Needs auth + storage.

If you want either, say so and I'll spec the minimal, privacy-respecting backend (e.g. metadata-only, client-side encryption, explicit opt-in) before building. Until then they stay deferred by design.

> **Decision (2026-06-08): Daniel chose to KEEP C2 + D3 DEFERRED** — preserve the absolute 100%-client-side privacy moat. The roadmap is therefore COMPLETE for all non-backend work. Don't build a backend without a fresh, explicit go-ahead.

## 4. Explicitly deferred (need your decision)
- **Heavy-dependency ingest & local model (G1, I2)** — ✅ **built (2026-06-08)** after the "go for all of them" call. All dynamically imported so the initial bundle is unchanged. Done with hyparquet (Parquet), pdf.js (PDF), tesseract.js (OCR), and `@huggingface/transformers` (WebGPU model).
- **Any backend** (C2 alerts/scheduled refresh, D3 accounts): crosses the 100%-client-side line. G3 already covers most of C2's value without a server. Still deferred.
- **Their actual model** (POS/QuickBooks integrations, multi-tenant SaaS, sales team, human consulting): deliberately *not* pursued — that's their game, capital-heavy, and not our edge.

## 5. How we'll know we're winning
- A non-technical user can upload *any* file and get a correct, professional answer to *any* reasonable question (Phase A) — track with the grounding eval suite + real questions.
- The action report's recommendations are specific and quantified, not generic (Phase B).
- Two-file compare and (opt-in) monitoring match the operator workflows people pay myAnalyst Pro for (Phase C) — without an integration project.
- Privacy stays absolute: raw rows never leave the browser. This is the line we never cross.

## 6. What I need from you
- **Nothing blocking — wave 2 is fully shipped.** Worth a manual pass on the new heavy-ingest paths with real files when convenient (a real Parquet, a tabular PDF, a screenshot of a table) and a try of on-device mode on a WebGPU browser, since those can't be unit-tested headlessly.
- **Still deferred unless you reopen it:** any of *our* backend (C2 managed alerts, D3 cloud accounts). G3 already covers most of C2's value without a server.
- **Small follow-up:** *(done)* BYOK now powers the Ask-your-data planner + answer, not just the narrator.

---

## 3c. Wave 3 — Bug-fix & AI-quality (added 2026-06-08)

> Waves 1–2 made the product broad and deep. Wave 3 tightens it: kill papercut bugs, and make the **AI answer more questions exactly and privately** so we lean on the (free-tier) LLM less and stay grounded more. Every item here keeps the 100%-client-side line. Ordered by value × leverage.

### Shipped (2026-06-08)
- **Cleanup — accidental root npm cruft removed** ✅ — a stray root `package.json`/`package-lock.json`/`node_modules` (declaring only `@huggingface/transformers`, already declared in `apps/web`) was deleted. Same class of accident as the earlier `headroom-ai` removal. The real dependency graph lives in `apps/web`.
- **W3.1 Median in Ask-your-data** ✅ — `median` is now a first-class aggregator in the deterministic engine (`aggregate()`, `AGG_WORDS`, `chooseAgg`) and in the LLM query-planner (`validatePlan` + the planner prompt). "median revenue", "median price by region" answer exactly, with no LLM call. **Beats:** a dashboard's fixed sum/avg tiles — and the free-tier LLM never gets touched for a stat we can compute.
- **W3.2 Count-distinct** ✅ — "how many unique products / number of distinct regions" now answers with the exact cardinality (`distinctCount`), only when a real column is named (a plain "how many records" still returns the row count).
- **W3.3 Aggregator-label bug fixed** ✅ — group rankings used a binary `mean ? "average" : "total"` label, so a median (or max/min) ranking was mislabelled a "total". Now a shared `labelForAgg()` names every aggregator correctly. Guarded by a regression test.
- *Tests:* +7 unit + 2 grounding evals → **178 unit tests**; typecheck + build + smoke green.

### Shipped — second batch (2026-06-08)
- **W3.4 Share / percentage-of-total** ✅ — "what % of revenue comes from North" → metric share (slice total ÷ grand total) with a pie; "what percentage of orders are South" → row-count share. Numerator/denominator shown in `method`.
- **W3.5 Percentiles & quartiles** ✅ — "90th percentile of price", "top/bottom quartile of revenue" via linear interpolation between order statistics (reuses the median sorted-array path).
- **W3.6 Numeric grounding verifier (AI trust)** ✅ — `lib/grounding.ts`: extracts the numbers from an LLM answer and classifies each as grounded (verbatim, sig-fig-rounded, or a transparent derivation — difference/sum/ratio/%/share/%-change) vs. unverifiable; structural numbers (small counts/ordinals ≤ 12, years) exempt, tolerances wide so legitimate figures are never wrongly flagged. Wired into `answerQuestionAI` (`RichAnswer.grounding`) and surfaced in `QueryBox` as "✓ Every figure traces back to your data" / "⚠ Couldn't verify: …". Pure + 9 unit tests.
- **W3.7 Two-dimension group-bys** ✅ — "revenue by region and product" cross-tabulates the metric (or counts) by two dimensions, names the top cell + combination count, and draws a stacked bar (`buildCrossTabChart`).
- **W3.8 Planner repair loop** ✅ — a rejected first plan (bad intent / unknown column) triggers ONE repair attempt feeding the exact reason + valid column names back to the model before the heuristic fallback. Pure, tested `planRejectionReason()`.

> **Wave 3 is COMPLETE.** Test suite **198 unit tests** + grounding evals, Playwright E2E, smoke — all green. The Ask-your-data engine now answers median / percentile / share-of-total / count-distinct / two-dimension breakdowns exactly and privately (no LLM round-trip), the LLM planner has median + a repair loop, and every AI answer carries a numeric grounding signal.

---

## 3d. Wave 4 — Consultant-grade reasoning in Q&A (added 2026-06-08)

> Waves 1–3 made the answers broad, exact and trustworthy. Wave 4 makes them *think like a senior analyst*: it exposes the heavy statistics the engine already computes (Welch's t-test, multiple regression, outlier detection, time-series MoM/YoY) directly through plain-English Ask-your-data — so a non-technical user can ask "is this difference real?", "what drives revenue?", "are there outliers?", "what's the monthly trend?" and get a rigorous, grounded answer with no LLM round-trip. 100% client-side; reuses `inference.ts` / `stats.ts` / `timeseries.ts`.

- **W4.1 Significance testing** — a comparison question with "significant / real / by chance / reliable" runs **Welch's t-test** on the two slices and states the means, the gap, the p-value, and a plain verdict ("IS / is NOT statistically significant"). **Beats:** a dashboard that shows a gap but never tells you if it's real.
- **W4.2 "What drives / predicts X"** — "what drives revenue?" fits a **multiple regression** of the other numeric columns on the target and reports the strongest standardized driver (β), which factors are significant, and the R² (how much is explained). **Beats:** their human consultant's headline analysis — automated and instant.
- **W4.3 Outlier / anomaly Q&A** — "are there outliers in price?" runs **z-score outlier detection** and names how many, the most extreme value and its σ-distance (or confirms the column is clean). Ties into the caveat that outliers skew averages.
- **W4.4 Time-grain trend** — "monthly revenue trend", "year over year" buckets by detected **cadence** and reports the latest period, MoM change, YoY change, and best/worst periods, with a line chart.

> **Wave 4 is COMPLETE (2026-06-08).** All four are live in `answerQuestion` (`query.ts`), reusing `welchTTest` / `multipleRegression` / `zOutliers` / `analyzeTimeSeries`, each unit-tested with hand-verified numbers and falling back cleanly when the data can't support it (too few rows, one group, collinear predictors, no time column). Test suite **205 unit tests** + grounding evals + Playwright E2E + smoke, all green. Ask-your-data now answers "is this real?", "what drives X?", "any outliers?", and "what's the monthly trend?" with proper statistics — no LLM round-trip.

---

### Status: wave 1 shipped · wave 2 COMPLETE (2026-06-08)
**Wave 1 (Phases A–D, client-side) is complete and live at myanalyst.net.** **Decision stands: MyAnalyst is 100% client-side / privacy-first** — managed-backend items (**C2** alerts, **D3** cloud accounts) remain deferred; **G3** is the privacy-preserving alternative.

**Wave 2 (Phases E–I, §3b) is fully shipped and pushed to `main`:** consultant-grade analysis (contribution decomposition, what-if/goal-seek, anomaly root-cause, open-text analytics), rigor/trust (significance everywhere, caveat propagation, methodology + reproducible recipe), the deliverable (text-first PDF report, white-label, slide deck), PWA/offline, bring-your-own-key narration, **heavy-dependency ingest (Parquet/PDF/OCR), and an on-device WebGPU model.** Test suite at **164 unit tests**, all green; typecheck + build + smoke pass. Next horizon would be a fresh wave (or the deferred backend items) — open for direction.
