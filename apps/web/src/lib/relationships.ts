import type { ColumnProfile, RelationshipMatrix, RelationshipPair, Table } from "./types";
import { numericColumn } from "./profile";
import { pearsonTest } from "./inference";
import { isRedundantCorrelation } from "./stats";

// Relationship explorer: the full pairwise Pearson-correlation matrix over the numeric columns, so the
// dashboard can show an interactive heatmap and let the user drill into any pair (scatter + trend line).
// The single-pair stats (significance, Fisher-z CI) reuse the same statsmodels-grade `pearsonTest` the
// narrator uses, so the explorer and the insights never disagree. Pure + worker-safe.

const MAX_COLS = 12; // keep the heatmap legible and the O(k²) pair scan cheap on wide tables

function strengthOf(r: number): RelationshipPair["strength"] {
  const a = Math.abs(r);
  return a >= 0.6 ? "strong" : a >= 0.3 ? "moderate" : "weak";
}

export function buildRelationships(table: Table, profiles: ColumnProfile[]): RelationshipMatrix | undefined {
  const numeric = profiles.filter((p) => p.role === "metric" && p.numeric && (p.numeric.std ?? 0) > 0).slice(0, MAX_COLS);
  if (numeric.length < 2) return undefined;

  const columns = numeric.map((p) => p.name);
  const cols = numeric.map((p) => numericColumn(table, p.name));
  const n = columns.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(NaN));
  const pairs: RelationshipPair[] = [];

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const test = pearsonTest(cols[i], cols[j]);
      const r = test ? test.r : NaN;
      matrix[i][j] = r;
      matrix[j][i] = r;
      if (test) {
        pairs.push({
          a: columns[i],
          b: columns[j],
          r: test.r,
          strength: strengthOf(test.r),
          p: test.p,
          significant: test.significant,
          ciLow: test.ciLow,
          ciHigh: test.ciHigh,
          n: test.n,
          redundant: isRedundantCorrelation(columns[i], columns[j], test.r),
        });
      }
    }
  }

  pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return { columns, matrix, pairs };
}
