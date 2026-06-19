import type { Cadence, PeriodPoint, SeasonIndex, SeasonPattern, Table, TimeSeriesAnalysis } from "./types";
import { numericColumn } from "./profile";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Richer time-series analysis: detect the data's natural cadence (daily…yearly), aggregate a metric
// into those periods, and compute period-over-period change (incl. year-over-year when a full season is
// present) plus a moving average. Pure, dependency-free, metadata-only output - safe in the worker.

const DAY = 86_400_000;
const cadenceLabel: Record<Cadence, string> = { daily: "day", weekly: "week", monthly: "month", quarterly: "quarter", yearly: "year" };
/** periods per year, used to find the same period a year earlier. */
const seasonLength: Record<Cadence, number> = { daily: 365, weekly: 52, monthly: 12, quarterly: 4, yearly: 1 };

export function cadenceNoun(c: Cadence): string {
  return cadenceLabel[c];
}

function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function cadenceFromGapDays(gap: number): Cadence {
  if (gap <= 1.5) return "daily";
  if (gap <= 10) return "weekly";
  if (gap <= 45) return "monthly";
  if (gap <= 130) return "quarterly";
  return "yearly";
}

function isoWeek(d: Date): string {
  // ISO-8601 week number, used for weekly bucketing.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function bucketLabel(d: Date, cadence: Cadence): string {
  const y = d.getFullYear();
  switch (cadence) {
    case "daily": return d.toISOString().slice(0, 10);
    case "weekly": return isoWeek(d);
    case "monthly": return `${y}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    case "quarterly": return `${y}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    case "yearly": return `${y}`;
  }
}

/**
 * Drop an obviously incomplete final period (e.g. the current, half-finished month) so it doesn't drag a
 * revenue trend or forecast artificially downward. Conservative - only trims when the last value sits far
 * below the typical level of the periods before it, so a genuinely weak final month isn't discarded.
 */
export function trimPartialTail(values: number[]): number[] {
  if (values.length < 4) return values;
  const prior = values.slice(0, -1);
  const sorted = [...prior].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  return med > 0 && values[values.length - 1] < 0.5 * med ? prior : values;
}

/** Trailing moving average over `window` periods (null until enough history). */
function movingAverage(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < window) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += values[j];
    out.push(sum / window);
  }
  return out;
}

/** Detect cadence from a set of timestamps (ms) - exposed for reuse (e.g. cohort analysis). */
export function detectCadence(times: number[]): Cadence {
  const sorted = [...times].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push((sorted[i] - sorted[i - 1]) / DAY);
  return cadenceFromGapDays(median(gaps.filter((g) => g > 0)) || 30);
}

/** The period bucket label for a date at a given cadence (e.g. "2023-Q2") - exposed for reuse. */
export function periodKey(d: Date, cadence: Cadence): string {
  return bucketLabel(d, cadence);
}

/**
 * Find a recurring within-cycle pattern (month-of-year, quarter-of-year, or weekday) by averaging the
 * metric at each cycle position across the data and comparing to the overall average. Only claims a
 * pattern when there are ≥2 full cycles, every position is covered, and the swing is real (peak ≥15%
 * above average). Pure; returns undefined when there's no clear seasonality. Exported for testing.
 */
export function detectSeasonality(periods: PeriodPoint[], cadence: Cadence): SeasonPattern | undefined {
  let unit: SeasonPattern["unit"];
  let cycle: number;
  let position: (label: string) => { order: number; name: string } | null;
  if (cadence === "monthly") {
    unit = "month"; cycle = 12;
    position = (l) => { const m = Number(l.slice(5, 7)); return m >= 1 && m <= 12 ? { order: m - 1, name: MONTHS[m - 1] } : null; };
  } else if (cadence === "quarterly") {
    unit = "quarter"; cycle = 4;
    position = (l) => { const q = Number(l.slice(l.indexOf("Q") + 1)); return q >= 1 && q <= 4 ? { order: q - 1, name: `Q${q}` } : null; };
  } else if (cadence === "daily") {
    unit = "weekday"; cycle = 7;
    position = (l) => { const d = new Date(l + "T00:00:00Z"); if (Number.isNaN(d.getTime())) return null; const w = d.getUTCDay(); return { order: w, name: WEEKDAYS[w] }; };
  } else {
    return undefined; // weekly/yearly: within-cycle seasonality is noisy or undefined
  }

  if (periods.length < 2 * cycle) return undefined;

  const buckets = new Map<number, { name: string; sum: number; count: number }>();
  for (const p of periods) {
    const pos = position(p.label);
    if (!pos || !Number.isFinite(p.value)) continue;
    const b = buckets.get(pos.order) ?? { name: pos.name, sum: 0, count: 0 };
    b.sum += p.value; b.count += 1;
    buckets.set(pos.order, b);
  }
  if (buckets.size < cycle) return undefined; // require every position to be observed

  const overall = [...buckets.values()].reduce((s, b) => s + b.sum, 0) / [...buckets.values()].reduce((s, b) => s + b.count, 0);
  if (!Number.isFinite(overall) || overall === 0) return undefined;

  const indices: SeasonIndex[] = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, b]) => ({ label: b.name, avg: b.sum / b.count, index: b.sum / b.count / overall }));

  let peak = indices[0];
  let trough = indices[0];
  for (const s of indices) { if (s.index > peak.index) peak = s; if (s.index < trough.index) trough = s; }
  // Require a real swing - a flat profile isn't "seasonal".
  if (peak.index < 1.15) return undefined;

  return { unit, indices, peak, trough, strength: peak.index - trough.index };
}

export function analyzeTimeSeries(table: Table, timeCol: string, metricName: string, forceCadence?: Cadence): TimeSeriesAnalysis | undefined {
  const vals = numericColumn(table, metricName);
  const points: { t: number; v: number }[] = [];
  table.rows.forEach((r, i) => {
    const d = new Date(String(r[timeCol]));
    if (!Number.isNaN(d.getTime()) && Number.isFinite(vals[i])) points.push({ t: d.getTime(), v: vals[i] });
  });
  if (points.length < 3) return undefined;
  points.sort((a, b) => a.t - b.t);

  // Cadence from the median gap between consecutive timestamps - or a caller-forced one (e.g. summing
  // dense transactions up to MONTHLY so a revenue trend isn't drowned in day-to-day noise).
  const gaps: number[] = [];
  for (let i = 1; i < points.length; i++) gaps.push((points[i].t - points[i - 1].t) / DAY);
  const cadence = forceCadence ?? cadenceFromGapDays(median(gaps.filter((g) => g > 0)) || 30);

  // Aggregate (sum) into period buckets, preserving chronological order.
  const buckets = new Map<string, number>();
  for (const p of points) {
    const label = bucketLabel(new Date(p.t), cadence);
    buckets.set(label, (buckets.get(label) ?? 0) + p.v);
  }
  const periods: PeriodPoint[] = [...buckets.entries()].map(([label, value]) => ({ label, value }));
  if (periods.length < 2) return undefined;

  const values = periods.map((p) => p.value);
  const latest = periods[periods.length - 1];
  const previous = periods[periods.length - 2];
  const changePct = previous && previous.value !== 0 ? (latest.value - previous.value) / Math.abs(previous.value) : undefined;

  const season = seasonLength[cadence];
  let yoyChangePct: number | undefined;
  if (season > 1 && periods.length > season) {
    const yearAgo = periods[periods.length - 1 - season];
    if (yearAgo && yearAgo.value !== 0) yoyChangePct = (latest.value - yearAgo.value) / Math.abs(yearAgo.value);
  }

  const window = Math.min(cadence === "monthly" ? 3 : cadence === "quarterly" ? 4 : cadence === "daily" ? 7 : 3, periods.length);
  const movingAvg = movingAverage(values, Math.max(2, window));

  let best = periods[0];
  let worst = periods[0];
  for (const p of periods) {
    if (p.value > best.value) best = p;
    if (p.value < worst.value) worst = p;
  }

  const seasonality = detectSeasonality(periods, cadence);

  return { metric: metricName, cadence, periods, latest, previous, changePct, yoyChangePct, movingAvg, best, worst, seasonality };
}
