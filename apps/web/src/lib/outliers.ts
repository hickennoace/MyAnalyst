import type { OutlierAnalysis } from "./types";
import { mean, median, std } from "./stats";

// Outlier analysis that knows the difference between a SKEWED SEGMENT and a real ANOMALY.
//
// A plain |z|>3 rule flags the whole upper tail of a right-skewed column — e.g. every luxury car in a
// sales table — and then (unhelpfully, even alarmingly) says "check whether these are real". But a
// premium price tier isn't a data error. This module classifies a metric's extreme values:
//   • "skew"    — a heavy one-sided tail / distinct high (or low) segment: report it as distribution
//                 shape and steer the reader to the MEDIAN, don't cry "errors".
//   • "anomaly" — a few isolated points detached from the rest: worth checking (likely typos/glitches).
// Pure + worker-safe.

const MIN_N = 8;

/** Population skewness g1 = mean(((x−μ)/σ)³). >0 right-tailed, <0 left-tailed. */
function skewness(xs: number[], mu: number, sigma: number): number {
  if (sigma === 0 || xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += ((x - mu) / sigma) ** 3;
  return s / xs.length;
}

/**
 * Analyze a numeric column's extreme values. Returns undefined when there's too little data, no spread,
 * or nothing extreme. `threshold` is the |z| cutoff for "extreme".
 */
export function analyzeColumnOutliers(column: string, xs: number[], threshold = 3): OutlierAnalysis | undefined {
  const finite: { index: number; value: number }[] = [];
  xs.forEach((x, i) => { if (Number.isFinite(x)) finite.push({ index: i, value: x }); });
  const n = finite.length;
  if (n < MIN_N) return undefined;

  const values = finite.map((f) => f.value);
  const mu = mean(values);
  const sigma = std(values);
  if (sigma === 0) return undefined;
  const med = median(values);
  const skew = skewness(values, mu, sigma);

  const extremes = finite
    .map((f) => ({ index: f.index, value: f.value, z: (f.value - mu) / sigma }))
    .filter((e) => Math.abs(e.z) >= threshold)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  if (!extremes.length) return undefined;

  const highCount = extremes.filter((e) => e.z > 0).length;
  const lowCount = extremes.length - highCount;
  const direction: OutlierAnalysis["direction"] = highCount && lowCount ? "both" : highCount ? "high" : "low";
  const share = extremes.length / n;
  const oneSidedFrac = Math.max(highCount, lowCount) / extremes.length;
  // How far the most-extreme value sits from the median, as a multiple. A real premium/low tier is a
  // moderate multiple (luxury cars ~5× the typical price); a 50× spike is a glitch, not a segment.
  const tailRatio = Math.abs(extremes[0].value) / (Math.abs(med) || 1);

  // It's a skewed SEGMENT (use the median, don't cry "errors") when there's a genuine one-sided TAIL —
  // several points, clearly one direction, a notably skewed column, at a plausible (not absurd) magnitude.
  // Otherwise it's isolated ANOMALIES: too few, two-sided, or so far out they read as data errors.
  const looksLikeSegment = extremes.length >= 5 && oneSidedFrac >= 0.8 && Math.abs(skew) > 1 && tailRatio <= 15;
  const kind: OutlierAnalysis["kind"] = looksLikeSegment ? "skew" : "anomaly";

  return {
    column,
    count: extremes.length,
    share,
    kind,
    direction,
    skew,
    mean: mu,
    median: med,
    std: sigma,
    examples: extremes.slice(0, 4),
    indices: extremes.map((e) => e.index),
  };
}
