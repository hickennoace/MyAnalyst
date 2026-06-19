import type { BestSellers, ColumnProfile, Performer, Table } from "./types";
import { numericColumn } from "./profile";
import { gini } from "./concentration";
import { quantityMetric, revenueMetric } from "./semantics";

// Best-seller analysis - the first question any sales dataset prompts: "what sells the most?"
// For the most telling product/category dimension, rank every value by the revenue it drives AND by
// volume (units sold, or transaction count). Revenue and volume leaders are often DIFFERENT products
// (a cheap item sells the most units; a premium item makes the most money) - surfacing both is the
// decisive read a dealer/retailer wants. Pure + worker-safe.

const MIN_DISTINCT = 2;
const MAX_DISTINCT = 60; // above this it's an id list, not a product catalog

/** Which categorical column best represents "the product/category being sold". */
function candidateDimensions(profiles: ColumnProfile[], rowCount: number, exclude: Set<string>): ColumnProfile[] {
  return profiles.filter(
    (p) =>
      (p.role === "dimension" || p.role === "identifier") &&
      p.type !== "date" &&
      !exclude.has(p.name) &&
      p.distinctCount >= MIN_DISTINCT &&
      p.distinctCount <= Math.min(MAX_DISTINCT, Math.max(MIN_DISTINCT, rowCount * 0.5)) &&
      // skip near-unique / free-text-ish columns (every row its own value)
      (p.role === "identifier" || (p.cardinalityRatio ?? 0) <= 0.6)
  );
}

export function analyzeBestSellers(table: Table, profiles: ColumnProfile[]): BestSellers | undefined {
  const revenue = revenueMetric(profiles, true);
  if (!revenue) return undefined; // no honest revenue measure → no best-seller story
  const qty = quantityMetric(profiles, revenue);

  const revVals = numericColumn(table, revenue.name);
  const qtyVals = qty ? numericColumn(table, qty.name) : null;
  const dims = candidateDimensions(profiles, table.rowCount, new Set([revenue.name, qty?.name ?? ""]));
  if (!dims.length) return undefined;

  // Pick the dimension where the choice matters most - the one whose revenue is most unevenly spread
  // across its values (highest Gini). That's the dimension with real winners and losers (usually the
  // product/model), not an evenly-split attribute like color or region.
  let best: { dim: ColumnProfile; agg: Map<string, { rev: number; units: number }>; totalRev: number; g: number } | undefined;
  for (const dim of dims) {
    const agg = new Map<string, { rev: number; units: number }>();
    table.rows.forEach((r, i) => {
      const raw = r[dim.name];
      if (raw === null || raw === undefined || raw === "") return;
      const key = String(raw);
      const b = agg.get(key) ?? { rev: 0, units: 0 };
      const v = revVals[i];
      if (Number.isFinite(v) && v >= 0) b.rev += v;
      b.units += qtyVals ? (Number.isFinite(qtyVals[i]) ? qtyVals[i] : 0) : 1;
      agg.set(key, b);
    });
    if (agg.size < MIN_DISTINCT) continue;
    const totalRev = [...agg.values()].reduce((s, b) => s + b.rev, 0);
    if (totalRev <= 0) continue;
    const g = gini([...agg.values()].map((b) => b.rev));
    if (!best || g > best.g) best = { dim, agg, totalRev, g };
  }
  if (!best) return undefined;

  const totalUnits = [...best.agg.values()].reduce((s, b) => s + b.units, 0) || 1;
  const performers: Performer[] = [...best.agg.entries()].map(([name, b]) => ({
    name,
    revenue: b.rev,
    revenueShare: b.rev / best!.totalRev,
    units: b.units,
    unitShare: b.units / totalUnits,
  }));
  const byRevenue = [...performers].sort((a, b) => b.revenue - a.revenue);
  const byUnits = [...performers].sort((a, b) => b.units - a.units);

  return {
    dimension: best.dim.name,
    metric: revenue.name,
    distinct: performers.length,
    totalRevenue: best.totalRev,
    totalUnits,
    byRevenue: byRevenue.slice(0, 6),
    byUnits: byUnits.slice(0, 6),
    topRevenue: byRevenue[0],
    topUnits: byUnits[0],
    hasQuantity: !!qty,
  };
}
