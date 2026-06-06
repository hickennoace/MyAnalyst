// Core contracts for Quantia's analysis engine.
// Everything flows: raw file -> Table -> ColumnProfile[] -> Domain -> KPIs/Stats/Charts -> Insights -> DashboardSpec.
// These types are the seams between stages; keep them stable so stages can be swapped independently.

/** A parsed tabular dataset: header row + raw cell matrix, before typing. */
export interface Table {
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export type SemanticType =
  | "number"
  | "currency"
  | "percent"
  | "integer"
  | "date"
  | "boolean"
  | "category"
  | "id"
  | "text";

/** Per-column profile: the statistical fingerprint that drives KPI/chart/domain choices. */
export interface ColumnProfile {
  name: string;
  type: SemanticType;
  /** Fraction of non-null values, 0..1 */
  fillRate: number;
  distinctCount: number;
  /** distinctCount / nonNull count, 0..1 — low = categorical-ish */
  cardinalityRatio: number;
  /** Numeric-only summary stats (undefined for non-numeric). */
  numeric?: NumericSummary;
  /** Date-only span (undefined for non-date). */
  dateRange?: { min: string; max: string };
  /** A few example values for display. */
  samples: string[];
  /** Heuristic role used by the KPI/chart engines. */
  role: "metric" | "dimension" | "time" | "identifier" | "other";
}

export interface NumericSummary {
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  sum: number;
  count: number;
}

export type Domain =
  | "financial-timeseries"
  | "sales-operational"
  | "marketing"
  | "survey"
  | "generic";

export interface DomainGuess {
  domain: Domain;
  confidence: number; // 0..1
  reason: string;
}

export interface Kpi {
  id: string;
  name: string;
  value: number | string;
  unit?: string;
  /** period-over-period delta as a fraction, e.g. 0.23 = +23% */
  trend?: number;
  howComputed: string;
  /** relevance score used to rank/limit cards */
  relevance: number;
}

export type ChartType =
  | "line"
  | "bar"
  | "scatter"
  | "area"
  | "pie"
  | "heatmap"
  | "histogram";

/** A self-contained chart: an ECharts option plus metadata. The renderer just hands `option` to ECharts. */
export interface ChartSpec {
  id: string;
  type: ChartType;
  title: string;
  subtitle?: string;
  /** Ready-to-render ECharts option object. */
  option: Record<string, unknown>;
  /** Why the engine picked this chart (shown as a tooltip / caption). */
  rationale: string;
}

export interface Insight {
  id: string;
  text: string;
  confidence: "high" | "medium" | "low";
  /** ids of KPIs/stats this claim is grounded in — every insight must cite at least one. */
  cites: string[];
  kind: "trend" | "correlation" | "regression" | "outlier" | "composition" | "summary";
}

/** Metadata-only context handed to an InsightProvider. NEVER contains raw rows. */
export interface InsightContext {
  domain: Domain;
  rowCount: number;
  columns: { name: string; type: SemanticType; role: ColumnProfile["role"] }[];
  kpis: Kpi[];
  correlations: CorrelationPair[];
  regression?: RegressionResult;
  trends: TrendFact[];
  outliers: OutlierFact[];
}

export interface CorrelationPair {
  a: string;
  b: string;
  r: number;
  strength: "strong" | "moderate" | "weak";
}

export interface RegressionResult {
  target: string;
  driver: string;
  slope: number;
  intercept: number;
  r2: number;
}

export interface TrendFact {
  metric: string;
  changePct: number; // fraction
  direction: "up" | "down" | "flat";
  from: number;
  to: number;
}

export interface OutlierFact {
  column: string;
  count: number;
  examples: { index: number; value: number; z: number }[];
}

/** The full declarative result the dashboard renders. */
export interface DashboardSpec {
  version: string;
  datasetName: string;
  domain: DomainGuess;
  generatedAt: string;
  rowCount: number;
  profiles: ColumnProfile[];
  kpis: Kpi[];
  charts: ChartSpec[];
  insights: Insight[];
}

/** Pluggable insight generator. Templated impl now; an LLM-backed impl can replace it later. */
export interface InsightProvider {
  readonly name: string;
  generate(ctx: InsightContext): Promise<Insight[]>;
}
