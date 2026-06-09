import type { Kpi } from "./types";

// Client for the Python analysis backend (see docs/06-python-migration.md). Sends the parsed (sampled)
// data to the Vercel Python function and returns its spec; a second call turns the grounded facts into
// LLM conclusions. Python is the PRIMARY engine: run() always calls it and only falls back to the
// in-browser TypeScript engine if the backend is unreachable, so the page never goes blank.

export interface PyChart {
  id: string;
  type: "line" | "bar" | "heatmap" | "scatter";
  title: string;
  subtitle?: string;
  x?: string[];
  series?: { name: string; values: (number | null)[] }[];
  matrix?: (number | null)[][];
  points?: number[][];
}

export interface PyFact {
  id: string;
  text: string;
  kind: string;
  value?: unknown;
}

export interface PyQuality {
  score: number;
  rows: number;
  columns: number;
  duplicates: number;
  completeness: number;
  issues: string[];
  rating: "good" | "fair" | "weak";
}

export interface PyAnalysisSpec {
  engine: "python";
  rowCount: number;
  currency?: { symbol: string; code: string };
  quality?: PyQuality;
  domain: { domain: string; confidence: number; reason: string };
  columns: { name: string; type: string; role: string }[];
  kpis: Kpi[];
  bestSellers?: {
    dimension: string;
    metric: string;
    topRevenue: { name: string; revenue: number; revenueShare: number; units: number; unitShare: number };
    topUnits: { name: string; revenue: number; revenueShare: number; units: number; unitShare: number };
    byRevenue: { name: string; revenue: number; revenueShare: number; units: number; unitShare: number }[];
    hasQuantity: boolean;
  } | null;
  trend?: Record<string, unknown> | null;
  forecast?: Record<string, unknown> | null;
  stats?: Record<string, unknown>;
  outliers?: Record<string, unknown>[];
  segments?: PySegmentation | null;
  rfm?: PyRfm | null;
  charts: PyChart[];
  facts: PyFact[];
  chartReadings?: { title: string; reading: string }[];
  methodology?: string[];
  narrative: string;
}

export interface PySegmentation {
  k: number;
  features: string[];
  segments: {
    id: number;
    label: string;
    size: number;
    sharePct: number;
    defining: { column: string; direction: "high" | "low"; mean: number; z: number }[];
  }[];
  sampled?: number | null;
}

export interface PyRfm {
  entity: string;
  customers: number;
  segments: {
    key: string;
    label: string;
    size: number;
    sharePct: number;
    avgMonetary: number;
    monetaryShare: number;
  }[];
}

export interface PyConclusions {
  provider: "groq" | "none";
  bottomLine: string;
  summary?: string;
  chartInsights?: { chart: string; insight: string }[];
  conclusions: string[];
  actions: { title: string; detail: string }[];
  grounding: { grounded: boolean; unverified: string[] };
  disclaimer: string;
}

// Base URL for the Python API. Empty = same-origin (`/api/...`, in-project functions). Set
// NEXT_PUBLIC_PY_API to a separate Python project's URL (e.g. https://myanalyst-api.vercel.app) when the
// Python backend is deployed as its own Vercel project — the robust setup, since Next.js shadows /api in
// the monorepo. CORS is enabled on the API.
const API_BASE = (process.env.NEXT_PUBLIC_PY_API || "").replace(/\/$/, "");
const api = (path: string) => `${API_BASE}${path}`;

// The POST body must stay under Vercel's 4.5 MB serverless limit. Rather than a fixed row cap, sample
// ADAPTIVELY to fill a byte budget: estimate bytes/row from the real serialized shape, then send as many
// evenly-spaced rows as fit. Narrow tables (the common case) get ~100k rows instead of a flat 40k — a
// richer, more faithful analysis — while wide tables stay safely under the limit (no 413s).
const MAX_PAYLOAD_BYTES = 3_800_000; // safety margin under 4.5 MB
const HARD_ROW_CAP = 100_000; // statistical plenty; also bounds server compute time

export function sampleForPayload(columns: string[], rows: Record<string, unknown>[]): unknown[][] {
  const toArr = (r: Record<string, unknown>) => columns.map((c) => r[c] ?? null);
  const n = rows.length;
  if (n === 0) return [];
  const probe = Math.min(300, n);
  let bytes = 0;
  for (let i = 0; i < probe; i++) bytes += JSON.stringify(toArr(rows[Math.floor((i * n) / probe)])).length + 1;
  const bytesPerRow = Math.max(1, bytes / probe);
  const cap = Math.min(n, HARD_ROW_CAP, Math.max(1, Math.floor(MAX_PAYLOAD_BYTES / bytesPerRow)));
  if (n <= cap) return rows.map(toArr);
  const stride = n / cap; // even spacing across the whole dataset
  const out: unknown[][] = [];
  for (let i = 0; i < cap; i++) out.push(toArr(rows[Math.floor(i * stride)]));
  return out;
}

// POST JSON to the Python backend with retries. Cold-start 500s, gateway timeouts, and transient network
// blips were silently blanking panels (a single failed /api/conclude → no conclusions; a failed /api/analyze
// → no Python KPIs). Retry the transient classes (network error, 5xx, 408, 429) a couple of times with
// backoff before giving up. 4xx (bad request, 413 payload-too-large) won't improve on retry, so fail fast.
const backoff = (attempt: number) => new Promise((r) => setTimeout(r, 300 * (attempt + 1)));

async function postJson<T>(path: string, payload: unknown, label: string, retries = 2): Promise<T> {
  const body = JSON.stringify(payload);
  let lastErr: Error = new Error(`${label} failed`);
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetch(api(path), { method: "POST", headers: { "Content-Type": "application/json" }, body });
    } catch (e) {
      // Network-level failure (DNS, CORS, dropped connection) — transient, retry.
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < retries) { await backoff(attempt); continue; }
      throw lastErr;
    }
    if (res.ok) return res.json() as Promise<T>;
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    const msg = err.error || `${label} (${res.status})`;
    if (res.status < 500 && res.status !== 408 && res.status !== 429) throw new Error(msg); // client error: don't retry
    lastErr = new Error(msg);
    if (attempt < retries) await backoff(attempt);
  }
  throw lastErr;
}

export async function runPythonAnalysis(
  columns: string[],
  rows: Record<string, unknown>[],
  currency?: { symbol: string; code: string }
): Promise<PyAnalysisSpec> {
  // The client saw the raw cells and detected the currency; the data we send is already cleaned to plain
  // numbers, so pass the currency along so the Python KPIs/charts agree with the rest of the dashboard.
  return postJson("/api/analyze", { columns, rows: sampleForPayload(columns, rows), currency }, "Python analysis failed");
}

export interface PyAnswer {
  provider: "groq" | "none";
  answer: string;
}

export async function runPythonAsk(
  question: string,
  columns: string[],
  rows: Record<string, unknown>[],
  facts?: PyFact[]
): Promise<PyAnswer> {
  return postJson("/api/ask", { question, columns, rows: sampleForPayload(columns, rows), facts }, "Ask failed");
}

export async function runPythonConclusions(spec: PyAnalysisSpec, userContext?: string): Promise<PyConclusions> {
  return postJson(
    "/api/conclude",
    {
      facts: spec.facts,
      kpis: spec.kpis.map((k) => ({ name: k.name, value: k.value })),
      chartReadings: spec.chartReadings,
      domain: spec.domain.domain,
      userContext,
      narrative: spec.narrative,
    },
    "Conclusions failed"
  );
}
