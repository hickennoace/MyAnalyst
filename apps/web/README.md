# Quantia Web (Next.js)

The Quantia frontend **and** — for this Vercel-first MVP — the analysis engine itself.
Upload a spreadsheet → get an instant, fully-explained dashboard (KPIs, charts, plain-language
insights) and an on-demand chart builder. Everything runs **client-side in the browser**: your
data never leaves the page.

## Run it

```bash
cd apps/web
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (what Vercel runs)
npm run typecheck  # tsc --noEmit
```

## Deploy to Vercel
Point Vercel at this repo with **Root Directory = `apps/web`**. Framework preset: Next.js.
No environment variables required for the current (no-API-key) build.

## Architecture (current MVP)

```
src/
├── app/
│   ├── page.tsx          # marketing landing page
│   ├── analyze/page.tsx  # the app: upload → pipeline → dashboard
│   ├── view/page.tsx     # read-only shared dashboard (decoded from URL hash)
│   ├── api/insights/route.ts # server-side LLM narrator (key never hits browser)
│   ├── layout.tsx
│   └── globals.css       # Tailwind v4 + dark theme
├── components/
│   ├── Uploader.tsx      # drag-drop + sample dataset
│   ├── DashboardView.tsx # shared dashboard body (used by /analyze and /view)
│   ├── CleaningReport.tsx # what was fixed + before/after preview
│   ├── KpiCard.tsx
│   ├── Chart.tsx         # ECharts wrapper (lazy, client-only)
│   ├── InsightCard.tsx
│   └── ChartBuilder.tsx  # "generate a graph" — NL + manual
└── lib/                  # the analysis engine (pure TypeScript)
    ├── types.ts          # contracts between every stage
    ├── parse.ts          # CSV/TSV/Excel → Table
    ├── clean.ts          # normalize + dedupe + drop total/empty rows → cleaned Table + CleaningReport
    ├── profile.ts        # type inference + per-column profiling
    ├── domain.ts         # rule-based domain detection
    ├── stats.ts          # mean/std/pearson/regression/outliers/cagr
    ├── kpi.ts            # domain-aware KPI engine
    ├── charts.ts         # auto chart recommendation + on-demand builder
    ├── nl-chart.ts       # plain-English → chart request (no LLM)
    ├── analyze.ts        # orchestrator: Table → DashboardSpec
    ├── export.ts         # dashboard → PNG / paginated PDF (lazy-loaded libs)
    ├── share.ts          # DashboardSpec ↔ gzip+base64url URL hash (read-only links)
    ├── sample.ts         # demo dataset
    └── insights/
        ├── templated.ts  # grounded, templated narrator (default)
        └── index.ts      # provider factory (swap in an LLM here later)
```

## The pipeline (mirrors docs/01-architecture.md, run locally)
`parse → clean & normalize → profile → detect domain → compute KPIs → run statistics → recommend charts → write insights → DashboardSpec → render`

Cleaning runs first and produces a transparent **CleaningReport** (rows removed, cells normalized,
per-column type detection) plus a **before/after preview** — the dashboard renders it above the KPIs.

## Smart, without an API key
All the "intelligence" — typing, domain detection, KPI selection, chart selection, statistics,
and the natural-language chart generator — is **deterministic algorithms**, no LLM, no cost.
Insight narration goes through the `InsightProvider` interface; the default `TemplatedInsightProvider`
fills sentence templates with numbers the engine actually computed (so it can't hallucinate).

## Real LLM insights (built in, off by default)
The insight narrator is pluggable and **provider-agnostic**:

- `app/api/insights/route.ts` — server-side endpoint holding the API key (never sent to the browser).
  Supports **Anthropic** and any **OpenAI-compatible** API (Groq, Gemini, OpenAI, OpenRouter).
  Accepts only the metadata-only `InsightContext`; applies a grounding guard (drops invented citations).
- `lib/insights/llm.ts` — `LlmInsightProvider` calls the route and **falls back to the templated
  narrator** on any failure (no key, network error, bad response), so enabling it can never break the UI.
- `lib/insights/index.ts` — selects the provider from `NEXT_PUBLIC_LLM_ENABLED`.

**To turn it on:** copy `.env.example` → `.env.local`, set `NEXT_PUBLIC_LLM_ENABLED=1`, pick
`LLM_PROVIDER`, and add `LLM_API_KEY` + `LLM_MODEL`. Free options: Groq or Gemini. No rewrite, no key = templated.

The privacy boundary (only `InsightContext` — never raw rows — crosses the wire) is enforced by the
interface and the route, exactly as the blueprint intends.

## Stack
Next.js 15 · React 19 · TypeScript · Tailwind v4 · ECharts · PapaParse · SheetJS (xlsx).
