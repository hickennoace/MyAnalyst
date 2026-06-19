import type { ColumnProfile, SemanticType, Table } from "./types";
import { numericColumn, profileTable } from "./profile";
import { welchTTest } from "./inference";

// Compare two datasets (e.g. this month vs last, store A vs store B, you vs a benchmark): align the
// shared numeric columns and report the biggest changes, ranked. Self-serve benchmarking, no
// integration - pure, metadata-only output.

export interface MetricChange {
  metric: string;
  type: SemanticType;
  sumA: number;
  sumB: number;
  sumDeltaPct: number | null;
  meanA: number;
  meanB: number;
  meanDeltaPct: number | null;
  /** Welch's t-test on the per-row values: is the difference in means statistically real? */
  meanSignificant?: boolean;
  meanP?: number;
}

export interface DatasetComparison {
  nameA: string;
  nameB: string;
  rowsA: number;
  rowsB: number;
  rowDeltaPct: number | null;
  /** shared numeric metrics, ranked by the size of the change in total. */
  metrics: MetricChange[];
  /** columns present in only one side. */
  onlyInA: string[];
  onlyInB: string[];
}

function sumMean(table: Table, col: string): { sum: number; mean: number } {
  const xs = numericColumn(table, col).filter(Number.isFinite);
  const sum = xs.reduce((s, v) => s + v, 0);
  return { sum, mean: xs.length ? sum / xs.length : NaN };
}

const pctDelta = (a: number, b: number): number | null => (a !== 0 && Number.isFinite(a) && Number.isFinite(b) ? ((b - a) / Math.abs(a)) * 100 : null);

export function compareDatasets(a: Table, b: Table, profilesA?: ColumnProfile[], profilesB?: ColumnProfile[]): DatasetComparison {
  const pa = profilesA ?? profileTable(a);
  const namesB = new Set(b.columns.map((c) => c.toLowerCase()));
  const namesA = new Set(a.columns.map((c) => c.toLowerCase()));

  const metrics: MetricChange[] = [];
  for (const p of pa.filter((p) => p.role === "metric" && p.numeric)) {
    // Find the matching column in B by exact (case-insensitive) name.
    const bCol = b.columns.find((c) => c.toLowerCase() === p.name.toLowerCase());
    if (!bCol) continue;
    const sa = sumMean(a, p.name);
    const sb = sumMean(b, bCol);
    const test = welchTTest(numericColumn(a, p.name), numericColumn(b, bCol));
    metrics.push({
      metric: p.name,
      type: p.type,
      sumA: sa.sum,
      sumB: sb.sum,
      sumDeltaPct: pctDelta(sa.sum, sb.sum),
      meanA: sa.mean,
      meanB: sb.mean,
      meanDeltaPct: pctDelta(sa.mean, sb.mean),
      meanSignificant: test?.significant,
      meanP: test?.p,
    });
  }
  metrics.sort((x, y) => Math.abs(y.sumDeltaPct ?? -1) - Math.abs(x.sumDeltaPct ?? -1));

  return {
    nameA: a.name,
    nameB: b.name,
    rowsA: a.rowCount,
    rowsB: b.rowCount,
    rowDeltaPct: pctDelta(a.rowCount, b.rowCount),
    metrics,
    onlyInA: a.columns.filter((c) => !namesB.has(c.toLowerCase())),
    onlyInB: b.columns.filter((c) => !namesA.has(c.toLowerCase())),
  };
}
