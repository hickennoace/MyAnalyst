# CLAUDE.md — working in this repo

## What Quantia is
An AI-assisted data-analysis product: upload a spreadsheet → instant, fully-explained dashboard
(cleaning report, KPIs, statistics, forecast, charts, plain-language insights), plus an "ask your
data" Q&A box, a custom chart builder, export (PNG/PDF), and shareable read-only links.

## Where the working product lives
**Everything shippable is in `apps/web`** — a Next.js 15 app, fully Vercel-deployable. The whole
analysis engine runs **client-side in the browser** (no backend); your data never leaves the page.
The `docs/` folder describes a larger future architecture (FastAPI compute tier, Postgres RLS, Redis
workers) that is **not built** — don't assume it exists.

## Working in `apps/web`
```bash
cd apps/web
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm test           # vitest (engine unit tests)
npm run build      # production build (what Vercel runs)
```
Tooling: **npm** (no pnpm installed), Node 22+. Windows shell is PowerShell; Bash is also available.

## Architecture in one line
`parse → clean → profile → detect domain → KPIs → stats → forecast → charts → insights → DashboardSpec → render`
The engine is pure TypeScript under `apps/web/src/lib`, with stable seams defined in `lib/types.ts`.
Add new analysis behind those seams. UI components are in `apps/web/src/components`; routes are
`/` (landing), `/analyze` (the app), `/view` (read-only shared dashboard), `/privacy`, and the
server route `/api/insights` (the only place an LLM key lives).

## Conventions
- **Privacy is the point:** raw rows stay in the browser. Only the metadata-only `InsightContext`
  (aggregates/stats) may cross to the LLM route. Never send raw data anywhere.
- **No new paid dependencies** without asking. The default narrator is local/templated; the LLM is
  optional and off by default (`NEXT_PUBLIC_LLM_ENABLED`).
- Match the surrounding code style. Verify changes with `npm run typecheck`, `npm test`, `npm run build`.
- There's a manual end-to-end script: `npx tsx scripts/smoke.mts`.

## Deploying
Vercel **Root Directory must be `apps/web`** and **Framework = Next.js** (pinned via
`apps/web/vercel.json`). See `DEPLOY.md`. A wrong Root Directory is the cause of the classic
"404 / No Output Directory `public`" errors.
