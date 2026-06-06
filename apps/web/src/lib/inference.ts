// Statistical inference engine — "statsmodels-grade", in pure TypeScript.
//
// statsmodels itself is Python and can't run in the browser/Vercel, so this implements the same rigor
// from first principles: the special functions (log-gamma, regularized incomplete beta & gamma) that
// give exact-ish CDFs for the Student-t, F, and chi-square distributions, and on top of them the tests
// that turn raw numbers into *defensible* conclusions: correlation significance, OLS with full
// inference (SE, t, p, CIs, adjusted R², F-test), one-way ANOVA, and the chi-square test of
// independence. Algorithms follow Numerical Recipes (Lentz continued fractions / series).

const EPS = 3e-12;
const FPMIN = 1e-300;
const ITMAX = 300;

// ── Special functions ────────────────────────────────────────────────────────

/** Natural log of the gamma function (Lanczos approximation). */
export function gammln(xx: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = xx;
  let tmp = xx + 5.5;
  tmp -= (xx + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / xx);
}

/** Continued fraction for the incomplete beta function (used by betai). */
function betacf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= ITMAX; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a,b). */
export function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(gammln(a + b) - gammln(a) - gammln(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Lower regularized incomplete gamma P(a,x) via series. */
function gser(a: number, x: number): number {
  if (x <= 0) return 0;
  const gln = gammln(a);
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 0; n < ITMAX; n++) {
    ap++;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - gln);
}

/** Upper regularized incomplete gamma Q(a,x) via continued fraction. */
function gcf(a: number, x: number): number {
  const gln = gammln(a);
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= ITMAX; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}

/** Lower regularized incomplete gamma P(a,x). */
export function gammp(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN;
  return x < a + 1 ? gser(a, x) : 1 - gcf(a, x);
}

// ── Distribution tail probabilities (p-values) ───────────────────────────────

/** Two-sided p-value for a Student-t statistic with df degrees of freedom. */
export function studentTTwoSidedP(t: number, df: number): number {
  if (df <= 0 || !Number.isFinite(t)) return NaN;
  return betai(df / 2, 0.5, df / (df + t * t));
}

/** Upper-tail p-value P(F > f) for an F statistic. */
export function fDistP(f: number, d1: number, d2: number): number {
  if (f <= 0) return 1;
  if (d1 <= 0 || d2 <= 0) return NaN;
  return betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * f));
}

/** Upper-tail p-value P(χ² > x) with df degrees of freedom. */
export function chiSquareP(x: number, df: number): number {
  if (x <= 0) return 1;
  if (df <= 0) return NaN;
  return 1 - gammp(df / 2, x / 2);
}

/** Standard normal CDF. */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}
function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  return s * gammp(0.5, x * x);
}

/** Critical two-sided t value for the given alpha (bisection on the survival function). */
export function tCritical(df: number, alpha = 0.05): number {
  if (df <= 0) return NaN;
  let lo = 0;
  let hi = 1e4;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    // studentTTwoSidedP decreases as t grows.
    if (studentTTwoSidedP(mid, df) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── Tests ────────────────────────────────────────────────────────────────────

export interface CorrelationTest {
  r: number;
  n: number;
  p: number; // two-sided
  ciLow: number;
  ciHigh: number;
  significant: boolean;
}

/** Pearson correlation with a significance test and a Fisher-z 95% CI. */
export function pearsonTest(xs: number[], ys: number[]): CorrelationTest | null {
  const pairs: [number, number][] = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++)
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pairs.push([xs[i], ys[i]]);
  const n = pairs.length;
  if (n < 4) return null;
  const mx = mean(pairs.map((p) => p[0]));
  const my = mean(pairs.map((p) => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  let r = sxy / Math.sqrt(sxx * syy);
  r = Math.max(-0.999999, Math.min(0.999999, r));
  const df = n - 2;
  const t = r * Math.sqrt(df / (1 - r * r));
  const p = studentTTwoSidedP(t, df);
  // Fisher z transform for the CI.
  const z = Math.atanh(r);
  const se = 1 / Math.sqrt(n - 3);
  const zc = 1.959963985;
  return { r, n, p, ciLow: Math.tanh(z - zc * se), ciHigh: Math.tanh(z + zc * se), significant: p < 0.05 };
}

export interface OlsResult {
  slope: number;
  intercept: number;
  r2: number;
  adjR2: number;
  slopeSE: number;
  slopeT: number;
  slopeP: number;
  fStat: number;
  fP: number;
  n: number;
  ciSlopeLow: number;
  ciSlopeHigh: number;
  significant: boolean;
}

/** Simple OLS y ~ x with full inference (SE, t, p, 95% CI, adjusted R², F-test). */
export function olsSimple(xs: number[], ys: number[]): OlsResult | null {
  const pairs: [number, number][] = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++)
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pairs.push([xs[i], ys[i]]);
  const n = pairs.length;
  if (n < 3) return null;
  const mx = mean(pairs.map((p) => p[0]));
  const my = mean(pairs.map((p) => p[1]));
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of pairs) {
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (y - my);
    syy += (y - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let ssRes = 0;
  for (const [x, y] of pairs) ssRes += (y - (slope * x + intercept)) ** 2;
  const r2 = syy === 0 ? 0 : 1 - ssRes / syy;
  const df = n - 2;
  const s2 = df > 0 ? ssRes / df : 0;
  const slopeSE = Math.sqrt(s2 / sxx) || 0;
  // SE = 0 means a perfect fit: the slope is infinitely significant (t = ∞, p = 0).
  const slopeT = slopeSE === 0 ? (slope === 0 ? 0 : Infinity) : slope / slopeSE;
  const slopeP =
    slopeSE === 0 ? (slope === 0 ? NaN : 0) : df > 0 ? studentTTwoSidedP(slopeT, df) : NaN;
  const adjR2 = df > 0 ? 1 - (1 - r2) * ((n - 1) / df) : r2;
  const fStat = 1 - r2 === 0 ? Infinity : (r2 / 1) / ((1 - r2) / df);
  const fP = fDistP(fStat, 1, df);
  const tc = tCritical(df);
  return {
    slope, intercept, r2, adjR2, slopeSE, slopeT, slopeP, fStat, fP, n,
    ciSlopeLow: slope - tc * slopeSE,
    ciSlopeHigh: slope + tc * slopeSE,
    significant: Number.isFinite(slopeP) && slopeP < 0.05,
  };
}

export interface AnovaResult {
  f: number;
  df1: number;
  df2: number;
  p: number;
  etaSq: number; // effect size (variance explained by the grouping)
  groups: { name: string; mean: number; n: number }[];
  significant: boolean;
}

/** One-way ANOVA: does the metric mean differ across the named groups? */
export function oneWayAnova(groups: Map<string, number[]>): AnovaResult | null {
  const entries = [...groups.entries()]
    .map(([name, vals]) => ({ name, vals: vals.filter(Number.isFinite) }))
    .filter((g) => g.vals.length >= 2);
  const k = entries.length;
  if (k < 2) return null;
  const all = entries.flatMap((g) => g.vals);
  const N = all.length;
  if (N - k < 1) return null;
  const grand = mean(all);
  let ssB = 0, ssW = 0;
  const groupStats: { name: string; mean: number; n: number }[] = [];
  for (const g of entries) {
    const gm = mean(g.vals);
    groupStats.push({ name: g.name, mean: gm, n: g.vals.length });
    ssB += g.vals.length * (gm - grand) ** 2;
    for (const v of g.vals) ssW += (v - gm) ** 2;
  }
  const df1 = k - 1;
  const df2 = N - k;
  const msB = ssB / df1;
  const msW = ssW / df2;
  const f = msW === 0 ? Infinity : msB / msW;
  const p = fDistP(f, df1, df2);
  const etaSq = ssB + ssW === 0 ? 0 : ssB / (ssB + ssW);
  groupStats.sort((a, b) => b.mean - a.mean);
  return { f, df1, df2, p, etaSq, groups: groupStats, significant: Number.isFinite(p) && p < 0.05 };
}

export interface ChiSquareResult {
  chi2: number;
  df: number;
  p: number;
  cramersV: number; // effect size, 0..1
  n: number;
  significant: boolean;
}

/** Chi-square test of independence for a contingency table (rows × cols of counts). */
export function chiSquareIndependence(counts: number[][]): ChiSquareResult | null {
  const rows = counts.length;
  const cols = counts[0]?.length ?? 0;
  if (rows < 2 || cols < 2) return null;
  const rowSum = counts.map((r) => r.reduce((a, b) => a + b, 0));
  const colSum = Array.from({ length: cols }, (_, j) => counts.reduce((a, r) => a + r[j], 0));
  const total = rowSum.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  let chi2 = 0;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const e = (rowSum[i] * colSum[j]) / total;
      if (e > 0) chi2 += (counts[i][j] - e) ** 2 / e;
    }
  const df = (rows - 1) * (cols - 1);
  const p = chiSquareP(chi2, df);
  const cramersV = Math.sqrt(chi2 / (total * Math.min(rows - 1, cols - 1)));
  return { chi2, df, p, cramersV, n: total, significant: Number.isFinite(p) && p < 0.05 };
}

export interface Description {
  n: number;
  mean: number;
  sd: number;
  cv: number; // coefficient of variation
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  skew: number;
  kurtosis: number; // excess
}

/** Full descriptive statistics for a numeric column. */
export function describe(values: number[]): Description | null {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  const n = xs.length;
  if (n < 2) return null;
  const m = mean(xs);
  let m2 = 0, m3 = 0, m4 = 0;
  for (const x of xs) {
    const d = x - m;
    m2 += d * d;
    m3 += d * d * d;
    m4 += d * d * d * d;
  }
  m2 /= n; m3 /= n; m4 /= n;
  const sd = Math.sqrt((m2 * n) / (n - 1)); // sample sd
  const skew = m2 > 0 ? m3 / m2 ** 1.5 : 0;
  const kurtosis = m2 > 0 ? m4 / (m2 * m2) - 3 : 0;
  return {
    n, mean: m, sd, cv: m !== 0 ? sd / Math.abs(m) : 0,
    min: xs[0], q1: quantile(xs, 0.25), median: quantile(xs, 0.5), q3: quantile(xs, 0.75), max: xs[n - 1],
    skew, kurtosis,
  };
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
