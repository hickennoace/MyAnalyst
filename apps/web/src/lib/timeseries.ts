import type { Cadence, PeriodPoint, Table, TimeSeriesAnalysis } from "./types";
import { numericColumn } from "./profile";

// Richer time-series analysis: detect the data's natural cadence (daily…yearly), aggregate a metric
// into those periods, and compute period-over-period change (incl. year-over-year when a full season is
// present) plus a moving average. Pure, dependency-free, metadata-only output — safe in the worker.

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

export function analyzeTimeSeries(table: Table, timeCol: string, metricName: string): TimeSeriesAnalysis | undefined {
  const vals = numericColumn(table, metricName);
  const points: { t: number; v: number }[] = [];
  table.rows.forEach((r, i) => {
    const d = new Date(String(r[timeCol]));
    if (!Number.isNaN(d.getTime()) && Number.isFinite(vals[i])) points.push({ t: d.getTime(), v: vals[i] });
  });
  if (points.length < 3) return undefined;
  points.sort((a, b) => a.t - b.t);

  // Cadence from the median gap between consecutive timestamps.
  const gaps: number[] = [];
  for (let i = 1; i < points.length; i++) gaps.push((points[i].t - points[i - 1].t) / DAY);
  const cadence = cadenceFromGapDays(median(gaps.filter((g) => g > 0)) || 30);

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

  return { metric: metricName, cadence, periods, latest, previous, changePct, yoyChangePct, movingAvg, best, worst };
}
