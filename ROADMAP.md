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

## 4. Explicitly deferred (need your decision)
- **Any backend** (C2 alerts/scheduled refresh, D3 accounts): crosses today's 100%-client-side line. Worth it for monitoring/saved dashboards, but it's infra to build/run — **your go/no-go when we reach Phase C.**
- **Heavy deps** (Parquet, DuckDB-WASM for exact huge-file analysis): bundle-size cost — decide per-feature.
- **Their actual model** (POS/QuickBooks integrations, multi-tenant SaaS, sales team, human consulting): deliberately *not* pursued — that's their game, capital-heavy, and not our edge.

## 5. How we'll know we're winning
- A non-technical user can upload *any* file and get a correct, professional answer to *any* reasonable question (Phase A) — track with the grounding eval suite + real questions.
- The action report's recommendations are specific and quantified, not generic (Phase B).
- Two-file compare and (opt-in) monitoring match the operator workflows people pay myAnalyst Pro for (Phase C) — without an integration project.
- Privacy stays absolute: raw rows never leave the browser. This is the line we never cross.

## 6. What I need from you
- **Now:** nothing — A2 and B1 are pure client-side + free-tier AI; I can build them next.
- **At Phase C/D3:** a yes/no on a small **opt-in backend** for alerts/scheduled refresh/saved accounts.
- **Optional, anytime:** a **target vertical/audience** to tune templates + copy toward, and whether to ever move off the free LLM tier for higher reliability.

---

### Status: roadmap complete (for the chosen strategy)
All client-side items are shipped and live. **Decision (2026-06-08): keep MyAnalyst 100% client-side / privacy-first** — so **C2 (refreshable sources + alerts)** and **D3 (encrypted accounts)** stay deferred (they'd require a backend, which crosses the no-upload moat). Revisit only if the privacy/architecture trade-off is reconsidered.
