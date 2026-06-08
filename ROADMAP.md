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

### Phase E — Consultant-grade analysis (the biggest unmatched value)
- **E1. Contribution / mix-shift decomposition** — when a total moves period-over-period, automatically attribute *how much* each segment, region, or product drove it ("Revenue rose 6.2% — North America +9pts, Enterprise tier −3pts on volume mix"). The single most common thing a human analyst is paid to explain. Pure client-side from data we already have. **Beats:** their dashboards show *that* a number changed; we explain *why*, by dimension. **Done-when:** any time-trend or two-dataset compare offers a one-click "what drove this?" breakdown that sums to the total.
- **E2. What-if scenario simulator** — sliders on the regression drivers we already compute; drag a lever, see the projected change in the target with a confidence band. **Beats:** static benchmarking — this is interactive, demo-worthy, and sticky. **Done-when:** a "Scenario" card lets a user adjust any significant driver and read off the modeled outcome, with the math shown.
- **E3. Goal-seek / target planner** — the inverse: "I want the target up 15% — what would each lever have to do?" Solves backward through the same model and ranks the most feasible paths. **Beats:** what a consultant whiteboards in a planning session. **Done-when:** enter a target, get ranked lever changes that reach it (or "not reachable from these factors").
- **E4. Root-cause drill-down on anomalies** — click any flagged anomaly/outlier → auto-decompose which dimension and rows produced it, with the supporting evidence. **Beats:** their alerts say "off track"; we say "off track *because* store #14's labor cost doubled on Tue." **Done-when:** every anomaly card has a "diagnose" action that returns the contributing slice.
- **E5. Open-text & survey analytics** — for free-text columns: client-side theme clustering, keyword extraction, and (LLM-optional) sentiment, surfaced as a card. **Beats:** no self-serve operator tool reads open-ended feedback; privacy makes it safe for HR/CSAT verbatims. **Done-when:** a dataset with a text column gets a "Themes & sentiment" card grounded in actual quotes.

### Phase F — Rigor as the moat (trust beats features)
- **F1. Significance everywhere** — "is this difference real?" badges on every comparison and group gap (CI + p-value, sample-size warnings), forecast confidence bands, and a clear "too few rows to trust" state. **Beats:** dashboards quote point numbers with false precision; we quantify uncertainty. **Done-when:** KPIs, comparisons, and forecasts all carry an honest confidence signal.
- **F2. Caveat propagation** — the data-quality scorecard's findings flow *into* every downstream insight: an insight built on a 40%-missing column is visibly flagged. **Beats:** a polished report that silently hides a garbage-in problem. **Done-when:** any KPI/insight derived from a low-quality column shows an inline trust flag linking back to the scorecard.
- **F3. Methodology appendix + reproducible recipe** — the export gains a "How this was computed" appendix (assumptions, tests, formulas), and the analysis can be saved as a self-contained recipe (JSON/HTML) that reproduces the same result on the same file. Pairs with the new not-financial-advice disclaimer. **Beats:** a black-box monthly PDF. **Done-when:** every exported report states its methods, and a saved recipe re-runs deterministically.

### Phase G — Reach without a backend
- **G1. Meet data where it lives** — Parquet (bundle-cost call), PDF-table extraction, paste-an-image-of-a-table (OCR), and multi-file drop. **Beats:** "export to CSV first" friction. **Done-when:** a user can drop a PDF/Parquet/image and get the same analysis pipeline.
- **G2. Install & offline (PWA) + mobile polish** — installable, works fully offline (the ultimate privacy proof: no network at all), responsive on phones/tablets. **Beats:** a login-gated web dashboard you can't use on the floor. **Done-when:** Lighthouse PWA pass, offline analysis works, dashboard is usable at mobile widths.
- **G3. Privacy-preserving "refresh" without our servers** — instead of C2's backend, let the user point at a Google Sheet/URL and re-run locally on each visit, with an optional self-hosted (their GitHub Action / cron) snapshot. **Beats:** their managed refresh — without us holding the data. **Done-when:** a saved source re-fetches and re-analyzes client-side on open.

### Phase H — The deliverable
- **H1. Text-first multi-page PDF** — the long-deferred B2 nicety: a proper paginated consultant report (cover, exec summary, action plan, methodology), not just a screenshot. **Done-when:** export produces a multi-page, text-selectable PDF.
- **H2. White-label / branded export** — drop in a logo and accent color for the report and presenter mode. **Beats:** their fixed branding. **Done-when:** a user can brand the exported deliverable.
- **H3. Auto-generated slide deck** — turn the analysis into a short presentation (title, key findings, action plan, chart slides) exportable as PDF/PPTX-style. **Beats:** hand-building a readout deck. **Done-when:** one click yields a presentable deck from the spec.

### Phase I — Optional AI depth (privacy intact)
- **I1. Bring-your-own-key LLM** — let power users plug their own provider key (stored locally only) for higher-reliability narration/planning, still metadata-only context. **Beats:** rate-limited free tier; zero extra cost to us, no privacy regression. **Done-when:** a user can supply a key in settings and the engine uses it client-side.
- **I2. In-browser LLM (WebGPU / transformers.js)** — optional fully-offline narration with no network call at all — the strongest possible privacy claim. **Done-when:** a small local model can narrate the story/insights with zero requests, behind an opt-in.

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
- **Now:** nothing blocking — the entire **Phase E** (contribution decomposition, what-if simulator, goal-seek, root-cause drill-down, open-text analytics) and **Phase F** (rigor/significance, caveat propagation, methodology) are pure client-side and can be built immediately. My recommended order: **E1 → E2 → F1** (highest consultant value, all reuse models we already compute).
- **Bundle-cost calls (per feature):** Parquet (G1), PDF/image table extraction (G1), in-browser WebGPU model (I2) — each adds weight; I'll flag the cost before pulling the dep.
- **One product call:** BYOK LLM (I1) — confirm you're happy letting power users supply their own key (stored locally only).
- **Still deferred unless you reopen it:** any of *our* backend (C2 managed alerts, D3 cloud accounts). G3 offers a privacy-preserving alternative to C2 that needs no server.

---

### Status: wave 1 shipped · wave 2 defined (2026-06-08)
**Wave 1 (Phases A–D, client-side) is complete and live at myanalyst.net.** **Decision stands: MyAnalyst is 100% client-side / privacy-first** — so managed-backend items (**C2** alerts, **D3** cloud accounts) remain deferred; **G3** is the privacy-preserving way to get most of C2's value without a server.

**Wave 2 (Phases E–I, §3b) is the new plan-of-record for staying ahead.** It's deliberately weighted toward analyses a senior consultant does by hand (E) and toward rigor/trust (F), since that — not feature count — is where AI + privacy lets us out-execute a vertical operator-BI platform. Next up: **E1 (contribution/mix-shift decomposition).** Just-shipped: the not-financial-advice disclaimer (footer + dashboard), which folds into **F3**.
