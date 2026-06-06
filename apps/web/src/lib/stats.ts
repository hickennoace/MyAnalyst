// Small, dependency-free statistics. The "calculator" half of the product — everything here is exact and local.

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

/** Pearson correlation coefficient, NaN-safe over the paired finite values. */
export function pearson(xs: number[], ys: number[]): number {
  const pairs: [number, number][] = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pairs.push([xs[i], ys[i]]);
  }
  if (pairs.length < 3) return NaN;
  const mx = mean(pairs.map((p) => p[0]));
  const my = mean(pairs.map((p) => p[1]));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? NaN : num / den;
}

export interface SimpleRegression {
  slope: number;
  intercept: number;
  r2: number;
}

/** Ordinary least squares y ~ x with R². */
export function linearRegression(xs: number[], ys: number[]): SimpleRegression {
  const pairs: [number, number][] = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pairs.push([xs[i], ys[i]]);
  }
  if (pairs.length < 2) return { slope: 0, intercept: 0, r2: 0 };
  const mx = mean(pairs.map((p) => p[0]));
  const my = mean(pairs.map((p) => p[1]));
  let sxy = 0;
  let sxx = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  let ssRes = 0;
  let ssTot = 0;
  for (const [x, y] of pairs) {
    const pred = slope * x + intercept;
    ssRes += (y - pred) ** 2;
    ssTot += (y - my) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

/** Z-score based outliers; returns indices into the original array with |z| >= threshold. */
export function zOutliers(xs: number[], threshold = 3): { index: number; value: number; z: number }[] {
  const finite = xs.filter((x) => Number.isFinite(x));
  const m = mean(finite);
  const s = std(finite);
  if (s === 0) return [];
  const out: { index: number; value: number; z: number }[] = [];
  xs.forEach((x, i) => {
    if (!Number.isFinite(x)) return;
    const z = (x - m) / s;
    if (Math.abs(z) >= threshold) out.push({ index: i, value: x, z });
  });
  return out.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}

/** Compound annual growth rate given first/last values and number of periods. */
export function cagr(first: number, last: number, periods: number): number {
  if (first <= 0 || periods <= 0) return NaN;
  return (last / first) ** (1 / periods) - 1;
}
