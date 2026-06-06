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
│   ├── page.tsx          # the whole app: upload → pipeline → dashboard
│   ├── layout.tsx
│   └── globals.css       # Tailwind v4 + dark theme
├── components/
│   ├── Uploader.tsx      # drag-drop + sample dataset
│   ├── KpiCard.tsx
│   ├── Chart.tsx         # ECharts wrapper (lazy, client-only)
│   ├── InsightCard.tsx
│   └── ChartBuilder.tsx  # "generate a graph" — NL + manual
└── lib/                  # the analysis engine (pure TypeScript)
    ├── types.ts          # contracts between every stage
    ├── parse.ts          # CSV/TSV/Excel → Table
    ├── profile.ts        # type inference + per-column profiling
    ├── domain.ts         # rule-based domain detection
    ├── stats.ts          # mean/std/pearson/regression/outliers/cagr
    ├── kpi.ts            # domain-aware KPI engine
    ├── charts.ts         # auto chart recommendation + on-demand builder
    ├── nl-chart.ts       # plain-English → chart request (no LLM)
    ├── analyze.ts        # orchestrator: Table → DashboardSpec
    ├── sample.ts         # demo dataset
    └── insights/
        ├── templated.ts  # grounded, templated narrator (default)
        └── index.ts      # provider factory (swap in an LLM here later)
```

## The pipeline (mirrors docs/01-architecture.md, run locally)
`parse → profile → detect domain → compute KPIs → run statistics → recommend charts → write insights → DashboardSpec → render`

## Smart, without an API key
All the "intelligence" — typing, domain detection, KPI selection, chart selection, statistics,
and the natural-language chart generator — is **deterministic algorithms**, no LLM, no cost.
Insight narration goes through the `InsightProvider` interface; the default `TemplatedInsightProvider`
fills sentence templates with numbers the engine actually computed (so it can't hallucinate).

## Plugging in a real LLM later (no rewrite)
1. Add an `LlmInsightProvider implements InsightProvider` that POSTs the **metadata-only**
   `InsightContext` to a Next.js route handler (`app/api/insights/route.ts`) holding the key server-side.
2. Select it in `lib/insights/index.ts` behind an env flag.
The privacy boundary (only `InsightContext` — never raw rows — crosses the wire) is enforced by the
interface, exactly as the blueprint intends.

## Stack
Next.js 15 · React 19 · TypeScript · Tailwind v4 · ECharts · PapaParse · SheetJS (xlsx).
