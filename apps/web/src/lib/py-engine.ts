import type { Kpi } from "./types";

// Client for the Python analysis backend (Phase 5 of the Python migration; see docs/06-python-migration.md).
// Sends the parsed (sampled) data to the Vercel Python function and returns its spec; a second call turns
// the grounded facts into LLM conclusions. Off by default — gated behind NEXT_PUBLIC_ENGINE=python so the
// live site keeps using the in-browser TypeScript engine until parity is verified.

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

/** True when the Python backend should drive analysis (opt-in, so the live default stays the TS engine). */
export function pythonEngineEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENGINE === "python";
}

// Base URL for the Python API. Empty = same-origin (`/api/...`, in-project functions). Set
// NEXT_PUBLIC_PY_API to a separate Python project's URL (e.g. https://myanalyst-api.vercel.app) when the
// Python backend is deployed as its own Vercel project — the robust setup, since Next.js shadows /api in
// the monorepo. CORS is enabled on the API.
const API_BASE = (process.env.NEXT_PUBLIC_PY_API || "").replace(/\/$/, "");
const api = (path: string) => `${API_BASE}${path}`;

// Keep the POST body under Vercel's 4.5 MB serverless limit — sample evenly when a file is large.
const SAMPLE_CAP = 40_000;

function sampleRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  if (rows.length <= SAMPLE_CAP) return rows;
  const stride = Math.ceil(rows.length / SAMPLE_CAP);
  return rows.filter((_, i) => i % stride === 0);
}

export async function runPythonAnalysis(columns: string[], rows: Record<string, unknown>[]): Promise<PyAnalysisSpec> {
  const sample = sampleRows(rows);
  const body = JSON.stringify({ columns, rows: sample.map((r) => columns.map((c) => r[c] ?? null)) });
  const res = await fetch(api("/api/analyze"), { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Python analysis failed (${res.status})`);
  }
  return res.json();
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
  const sample = sampleRows(rows);
  const body = JSON.stringify({ question, columns, rows: sample.map((r) => columns.map((c) => r[c] ?? null)), facts });
  const res = await fetch(api("/api/ask"), { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Ask failed (${res.status})`);
  }
  return res.json();
}

export async function runPythonConclusions(spec: PyAnalysisSpec, userContext?: string): Promise<PyConclusions> {
  const body = JSON.stringify({
    facts: spec.facts,
    kpis: spec.kpis.map((k) => ({ name: k.name, value: k.value })),
    chartReadings: spec.chartReadings,
    domain: spec.domain.domain,
    userContext,
    narrative: spec.narrative,
  });
  const res = await fetch(api("/api/conclude"), { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Conclusions failed (${res.status})`);
  }
  return res.json();
}
