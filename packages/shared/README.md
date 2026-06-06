# @quantia/shared — cross-tier contracts

The single source of truth for data shapes both the API (Python/Pydantic) and the web
(TypeScript) must agree on. The most important is the **Dashboard Spec** — the declarative
JSON the backend emits and the frontend renders.

## Contracts
- `dashboard-spec` — KPI cards, chart blocks (type + data ref + encodings), narrative/
  insight blocks, layout.
- `insight` — the InsightObject (claim, supporting numbers, confidence, action) and the
  **metadata-only `InsightContext`** that bounds what may cross to the LLM.
- `job` — job status + per-stage progress events streamed over SSE.
- `dataset` — dataset metadata + source types.

## Keeping Python & TS in sync
Author the schema once (e.g. JSON Schema or Pydantic) and generate TS types, or keep a
golden JSON Schema here that both sides validate against in CI. Pick one and enforce it.

> ⚠️ Scaffold only.
