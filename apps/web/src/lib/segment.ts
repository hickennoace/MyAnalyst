import type { ColumnProfile, Segment, SegmentMember, Segmentation, Table } from "./types";
import { numericColumn } from "./profile";

// Segmentation: a dependency-free k-means over the numeric columns that finds the natural groups in the
// data and describes each by the features that set it apart (high/low vs the overall average). Features
// are z-standardized so no single column dominates by scale; k is chosen by a simple elbow. Deterministic
// (seeded init) so results are stable across runs. Pure + worker-safe; operates on a capped sample for speed.

const SAMPLE_CAP = 4000;
const MIN_ROWS = 24;

/** Deterministic PRNG (mulberry32) so clustering is reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dist2(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s;
}

interface KMeans {
  assign: number[];
  centroids: number[][];
  inertia: number;
}

function kmeans(X: number[][], k: number, seed: number, iters = 30): KMeans {
  const n = X.length;
  const rand = rng(seed);
  // k-means++ seeding.
  const centroids: number[][] = [X[Math.floor(rand() * n)].slice()];
  while (centroids.length < k) {
    const d2 = X.map((x) => Math.min(...centroids.map((c) => dist2(x, c))));
    const total = d2.reduce((s, v) => s + v, 0) || 1;
    let r = rand() * total;
    let idx = 0;
    for (; idx < n; idx++) {
      r -= d2[idx];
      if (r <= 0) break;
    }
    centroids.push(X[Math.min(idx, n - 1)].slice());
  }

  const assign = new Array(n).fill(0);
  let inertia = 0;
  for (let it = 0; it < iters; it++) {
    let moved = false;
    inertia = 0;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist2(X[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      inertia += bestD;
      if (assign[i] !== best) {
        assign[i] = best;
        moved = true;
      }
    }
    // Recompute centroids.
    const sums = centroids.map(() => new Array(X[0].length).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      counts[assign[i]]++;
      const row = X[i];
      const s = sums[assign[i]];
      for (let j = 0; j < row.length; j++) s[j] += row[j];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) {
        // Re-seed an empty cluster to the point farthest from its centroid.
        let far = 0;
        let farD = -1;
        for (let i = 0; i < n; i++) {
          const d = dist2(X[i], centroids[assign[i]]);
          if (d > farD) {
            farD = d;
            far = i;
          }
        }
        centroids[c] = X[far].slice();
      } else {
        centroids[c] = sums[c].map((v) => v / counts[c]);
      }
    }
    if (!moved && it > 0) break;
  }
  return { assign, centroids, inertia };
}

interface Clustering {
  k: number;
  result: KMeans;
  /** table row index for each clustered (sampled) point. */
  sampleIdx: number[];
  cols: { name: string; values: number[]; mean: number; std: number }[];
  /** number of points clustered (≤ rowCount when sampled). */
  n: number;
}

/** The shared clustering core: standardize → sample → pick k → k-means. Deterministic. */
function cluster(table: Table, profiles: ColumnProfile[]): Clustering | undefined {
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric && (p.numeric.std ?? 0) > 0).slice(0, 6);
  if (metrics.length < 2 || table.rowCount < MIN_ROWS) return undefined;

  // Standardize each feature; sample for speed.
  const cols = metrics.map((m) => ({ name: m.name, values: numericColumn(table, m.name), mean: m.numeric!.mean, std: m.numeric!.std }));
  const stride = Math.max(1, Math.floor(table.rowCount / SAMPLE_CAP));
  const X: number[][] = [];
  const sampleIdx: number[] = [];
  for (let i = 0; i < table.rowCount; i += stride) {
    const row = cols.map((c) => (Number.isFinite(c.values[i]) ? (c.values[i] - c.mean) / c.std : 0));
    X.push(row);
    sampleIdx.push(i);
  }
  if (X.length < MIN_ROWS) return undefined;

  // Choose k by a simple elbow: accept a larger k only if it cuts inertia by >20%.
  const runs = new Map<number, KMeans>();
  for (const k of [2, 3, 4]) {
    if (k < X.length) runs.set(k, kmeans(X, k, 1234567));
  }
  let k = 2;
  if (runs.has(3) && runs.get(3)!.inertia < 0.8 * runs.get(2)!.inertia) k = 3;
  if (k === 3 && runs.has(4) && runs.get(4)!.inertia < 0.8 * runs.get(3)!.inertia) k = 4;
  const result = runs.get(k);
  if (!result) return undefined;
  return { k, result, sampleIdx, cols, n: X.length };
}

/** Per-row cluster assignment (sampled rows) — used to export a cluster's rows from the raw table. */
export function segmentMembers(table: Table, profiles: ColumnProfile[]): SegmentMember[] | undefined {
  const c = cluster(table, profiles);
  if (!c) return undefined;
  return c.result.assign.map((cl, i) => ({ rowIndex: c.sampleIdx[i], cluster: cl }));
}

export function segmentRows(table: Table, profiles: ColumnProfile[]): Segmentation | undefined {
  const clustering = cluster(table, profiles);
  if (!clustering) return undefined;
  const { k, result, sampleIdx, cols, n } = clustering;

  // Describe each cluster by its defining features (cluster mean vs global mean, in std units).
  const segments: Segment[] = [];
  for (let c = 0; c < k; c++) {
    const members = result.assign.map((a, i) => (a === c ? i : -1)).filter((i) => i >= 0);
    if (!members.length) continue;
    const defining = cols
      .map((col) => {
        const mean = members.reduce((s, i) => s + col.values[sampleIdx[i]], 0) / members.length;
        const z = col.std ? (mean - col.mean) / col.std : 0;
        return { column: col.name, direction: (z >= 0 ? "high" : "low") as "high" | "low", z, mean };
      })
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    const top = defining.filter((d) => Math.abs(d.z) > 0.25).slice(0, 3);
    const label = top.length
      ? top.slice(0, 2).map((d) => `${d.direction} ${d.column}`).join(", ")
      : "balanced / average";
    segments.push({
      id: c,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      size: members.length,
      sharePct: (members.length / n) * 100,
      defining: top.length ? top : defining.slice(0, 2),
    });
  }
  segments.sort((a, b) => b.size - a.size);
  return { k, features: cols.map((c) => c.name), segments, sampled: n < table.rowCount ? n : undefined };
}
