import type { ColumnProfile, Concentration, ConcentrationMember, ConcentrationSegment, Table } from "./types";
import { numericColumn } from "./profile";
import { isAdditive, revenueMetric } from "./semantics";

// Concentration / Pareto analysis — the "80–20" lens. For a categorical (or id) column and a measure,
// how much of the total do the biggest few categories hold? Answers questions every analyst asks but
// the engine didn't surface before: "what share of revenue comes from our top 5 customers?", "are sales
// concentrated in a handful of products (a risk) or spread evenly?". Pure + worker-safe; one pass per pair.

const TOP_KEEP = 8; // individual rows shown before the long tail rolls into "Other"
const MIN_CATEGORIES = 4; // below this there's no meaningful "few vs many" story
const MAX_METRICS = 3;
const MAX_DIMS = 5;

/** Gini coefficient of a set of non-negative values (0 = perfectly even, → 1 = one value holds all). */
export function gini(values: number[]): number {
  const xs = values.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  const n = xs.length;
  if (n === 0) return 0;
  let total = 0;
  let weighted = 0;
  for (let i = 0; i < n; i++) {
    total += xs[i];
    weighted += (2 * (i + 1) - n - 1) * xs[i]; // Σ (2i − n − 1) x_i, i 1-based
  }
  if (total === 0) return 0;
  return weighted / (n * total);
}

/** Build a concentration profile from per-category totals (already aggregated). */
function profileTotals(dimension: string, metric: string, metricIsCount: boolean, totals: Map<string, number>): Concentration | null {
  const entries = [...totals.entries()].filter(([, v]) => Number.isFinite(v) && v > 0);
  const distinct = entries.length;
  if (distinct < MIN_CATEGORIES) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const grand = entries.reduce((s, [, v]) => s + v, 0);
  if (grand <= 0) return null;

  // Pareto point: how many of the largest categories reach 80% of the total.
  let cum = 0;
  let paretoCount = 0;
  let paretoShare = 0;
  for (let i = 0; i < entries.length; i++) {
    cum += entries[i][1];
    if (paretoCount === 0 && cum / grand >= 0.8) {
      paretoCount = i + 1;
      paretoShare = cum / grand;
    }
  }
  if (paretoCount === 0) {
    paretoCount = distinct;
    paretoShare = 1;
  }

  // Display rows: the top N individually, the rest rolled into one "Other" row.
  const segments: ConcentrationSegment[] = [];
  let running = 0;
  const headCount = Math.min(TOP_KEEP, entries.length);
  for (let i = 0; i < headCount; i++) {
    running += entries[i][1];
    segments.push({ name: entries[i][0], value: entries[i][1], share: entries[i][1] / grand, cumShare: running / grand, rank: i + 1 });
  }
  if (entries.length > headCount) {
    const tail = entries.slice(headCount);
    const tailValue = tail.reduce((s, [, v]) => s + v, 0);
    segments.push({ name: `Other (${tail.length} ${tail.length === 1 ? "category" : "categories"})`, value: tailValue, share: tailValue / grand, cumShare: 1, rank: headCount + 1, isOther: true });
  }

  const g = gini(entries.map(([, v]) => v));
  const hhi = entries.reduce((s, [, v]) => s + (v / grand) ** 2, 0);
  const level: Concentration["level"] = g >= 0.6 ? "high" : g >= 0.4 ? "moderate" : "low";

  return {
    dimension,
    metric,
    metricIsCount,
    total: grand,
    distinct,
    segments,
    paretoCount,
    paretoShare,
    paretoPctOfCategories: paretoCount / distinct,
    topShare: entries[0][1] / grand,
    gini: g,
    hhi,
    level,
  };
}

/** Sum a metric (or count rows) grouped by a dimension column, in one pass. */
function groupTotals(table: Table, dimName: string, metricValues: number[] | null): Map<string, number> {
  const totals = new Map<string, number>();
  table.rows.forEach((r, i) => {
    const raw = r[dimName];
    if (raw === null || raw === undefined || raw === "") return;
    const key = String(raw);
    if (metricValues) {
      const v = metricValues[i];
      if (!Number.isFinite(v) || v < 0) return; // concentration is only meaningful for non-negative measures
      totals.set(key, (totals.get(key) ?? 0) + v);
    } else {
      totals.set(key, (totals.get(key) ?? 0) + 1);
    }
  });
  return totals;
}

/** Concentration of one measure (or row count) across one named column — for targeted NL questions. */
export function concentrationFor(table: Table, dimName: string, metric: { name: string; values: number[] } | null): Concentration | null {
  return profileTotals(dimName, metric ? metric.name : "row count", !metric, groupTotals(table, dimName, metric ? metric.values : null));
}

/**
 * The "vital few" categories that carry a concentration result — re-derived from the raw table so it
 * recovers every category up to the Pareto point (not just the top few shown before the "Other" roll-up).
 * Used to export the concentration as an actionable account list. Pure.
 */
export function concentrationMembers(table: Table, c: Concentration): ConcentrationMember[] {
  const metricValues = c.metricIsCount ? null : numericColumn(table, c.metric);
  const entries = [...groupTotals(table, c.dimension, metricValues).entries()]
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .sort((a, b) => b[1] - a[1]);
  const grand = entries.reduce((s, [, v]) => s + v, 0) || 1;
  let cum = 0;
  return entries.slice(0, c.paretoCount).map(([name, value], i) => {
    cum += value;
    return { rank: i + 1, name, value, share: value / grand, cumShare: cum / grand };
  });
}

/**
 * Find the most concentrated (measure × category) views in the dataset. Picks the best measure for each
 * candidate category column, scores by Gini (most uneven = most interesting), and returns the top few —
 * one per dimension for variety. Falls back to a row-count concentration when no usable measure exists.
 */
export function analyzeConcentration(table: Table, profiles: ColumnProfile[]): Concentration[] {
  // Only concentrate ADDITIVE measures (revenue, units) — "the top 3 brands hold 80% of revenue" is a
  // real risk; "…of customer age" is gibberish. Summing an attribute (age, rating, unit price) is never
  // the 80–20 story, so those columns are excluded here.
  const revenue = revenueMetric(profiles, true);
  const metrics = profiles
    .filter((p) => p.role === "metric" && p.numeric && (p.numeric.sum ?? 0) > 0 && isAdditive(p, revenue))
    .sort((a, b) => (b.numeric!.sum ?? 0) - (a.numeric!.sum ?? 0))
    .slice(0, MAX_METRICS);
  const dims = profiles
    .filter((p) => (p.role === "dimension" || p.role === "identifier") && p.distinctCount >= MIN_CATEGORIES && p.type !== "date")
    // The dimension must genuinely GROUP rows — if every value is its own row (distinct === rowCount),
    // "concentration" degenerates into the raw metric's dispersion, which isn't the 80–20 story.
    .filter((p) => p.distinctCount < table.rowCount)
    // Skip near-unique categorical columns (free-text-ish) where every value is its own group.
    .filter((p) => p.role === "identifier" || p.cardinalityRatio <= 0.6)
    .sort((a, b) => a.distinctCount - b.distinctCount)
    .slice(0, MAX_DIMS);

  const metricCols = metrics.map((m) => ({ name: m.name, values: numericColumn(table, m.name) }));
  const results: Concentration[] = [];

  for (const dim of dims) {
    let best: Concentration | null = null;
    for (const m of metricCols) {
      // A measure keyed by an identifier (e.g. revenue per customer) is the classic Pareto case; a
      // measure keyed by a low-cardinality dimension (revenue per region) is the mix-concentration case.
      const c = profileTotals(dim.name, m.name, false, groupTotals(table, dim.name, m.values));
      if (c && (!best || c.gini > best.gini)) best = c;
    }
    // No usable measure → fall back to how concentrated the row counts themselves are.
    if (!best) best = profileTotals(dim.name, "row count", true, groupTotals(table, dim.name, null));
    if (best) results.push(best);
  }

  // Surface only genuinely uneven distributions, strongest first, capped for the dashboard.
  return results
    .filter((c) => c.gini >= 0.3)
    .sort((a, b) => b.gini - a.gini)
    .slice(0, 3);
}
