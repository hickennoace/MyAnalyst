import type { ColumnProfile, Domain } from "./types";

// Metric semantics — the layer that keeps the analysis HONEST and business-relevant.
//
// The engine kept telling car-sales users to "make cheap cars cost like the expensive ones" and summed
// customer age by brand, because it didn't know which numbers mean what. This module answers two
// questions every downstream step needs:
//   1. Which column is the transaction VALUE? Summed, it's total revenue; the row count is volume.
//   2. For any numeric column, what math is meaningful — can it be summed (a flow: revenue, units),
//      or only averaged (an attribute: unit price, age, rating, %)?
// Summing a value is revenue; summing an attribute is nonsense. Get this right and the KPIs, the
// best-seller story, and the recommendations all fall into place.

// Names that denote an additive flow/value (safe to sum across rows).
const VALUE_NAME = /\b(revenue|sales?|amount|amt|turnover|gmv|spend(?:ing)?|cost|profit|gross|net|income|proceeds|booking|bookings|payment|charge|invoice|deal[_\s-]?(?:value|size)|line[_\s-]?total|sub[_\s-]?total|grand[_\s-]?total|total)\b/i;
// Names that denote TOP-LINE REVENUE specifically (money in) — excludes cost/profit/spend.
const REVENUE_NAME = /\b(revenue|sales?|turnover|gmv|income|proceeds|amount|amt|bookings?|net[_\s-]?sales|gross[_\s-]?sales|grand[_\s-]?total)\b/i;
const QTY_NAME = /\b(qty|quantity|units?|orders?|count|volume|sold|pieces?|items?|tickets?|seats?|bookings?)\b/i;
// Names that are per-row attributes — averaging is fine, summing is meaningless.
const ATTRIBUTE_NAME = /(%|percent|\brate\b|ratio|\bavg\b|average|\bmean\b|median|margin|\bscore\b|rating|\bindex\b|\bage\b|\byear\b|\bid\b|\bno\.?\b|\bnumber\b|\bcode\b|\bzip\b|postal|phone|\blat(?:itude)?\b|\blon(?:gitude)?\b|\blng\b|tenure|\bdays?\b|temperature|\btemp\b|weight|height|\bbmi\b|distance|duration|\bgpa\b)/i;
// "Price"/"unit price"/"MSRP" are values PER UNIT — an attribute of the product, not a sum-able flow,
// UNLESS the row is a single transaction (then the price paid is that sale's revenue).
const UNIT_PRICE_NAME = /\b(price|unit[_\s-]?price|msrp|list[_\s-]?price|fee|wage|salary|hourly|per[_\s-]?unit|rate)\b/i;

export type MetricKind = "value" | "quantity" | "attribute";

function isMetric(p: ColumnProfile): boolean {
  return p.role === "metric" && !!p.numeric;
}

/**
 * Is each row an individual transaction/event (a sale, an order, a ticket) rather than a pre-aggregated
 * or entity-level row? Transaction grain is what makes summing a unit price into revenue valid.
 */
export function isTransactionGrain(profiles: ColumnProfile[], rowCount: number): boolean {
  if (rowCount < 12) return false;
  const hasTime = profiles.some((p) => p.role === "time");
  // At least one categorical column that genuinely repeats across rows (so rows are events of a few kinds).
  const repeatingDim = profiles.some(
    (p) => (p.role === "dimension" || p.role === "identifier") && p.distinctCount >= 2 && p.distinctCount <= Math.max(2, rowCount * 0.7)
  );
  return hasTime && repeatingDim;
}

/**
 * The metric that represents transaction VALUE. Summed across rows, it is total revenue. Prefers an
 * explicitly value-named column (revenue/amount/sales/total), then a transaction-grain currency column
 * (e.g. the price paid on each sale). Returns undefined when nothing can be honestly summed into a total
 * — e.g. a price catalog with no transaction grain, or a price-series (financial) table.
 */
export function revenueMetric(profiles: ColumnProfile[], grain: boolean, domain?: Domain): ColumnProfile | undefined {
  // Price-SERIES data (stock OHLC etc.) has currency columns that are levels, never revenue — don't sum.
  if (domain === "financial-timeseries") return undefined;
  const metrics = profiles.filter(isMetric);

  // 1. A column named like top-line REVENUE (sales/revenue/amount/turnover) — never a cost/profit/spend,
  //    which are summable values but NOT the money coming in. The biggest such total is the revenue.
  const revenueNamed = metrics.filter((m) => REVENUE_NAME.test(m.name) && !ATTRIBUTE_NAME.test(m.name) && !QTY_NAME.test(m.name));
  if (revenueNamed.length) return byLargestTotal(revenueNamed);

  // 2. On transaction-grain data, the price paid per row is that sale's revenue → summable.
  if (grain) {
    const priceLike = metrics.filter((m) => (m.type === "currency" || UNIT_PRICE_NAME.test(m.name)) && !ATTRIBUTE_NAME.test(m.name));
    if (priceLike.length) return byLargestTotal(priceLike);
  }
  return undefined;
}

function byLargestTotal(metrics: ColumnProfile[]): ColumnProfile {
  return [...metrics].sort((a, b) => (b.numeric!.sum || 0) - (a.numeric!.sum || 0))[0];
}

/** A quantity column (units/qty/orders) whose sum is total volume — distinct from the value metric. */
export function quantityMetric(profiles: ColumnProfile[], revenue?: ColumnProfile): ColumnProfile | undefined {
  const qty = profiles.filter((p) => isMetric(p) && p.name !== revenue?.name && QTY_NAME.test(p.name) && !ATTRIBUTE_NAME.test(p.name));
  return qty.length ? byLargestTotal(qty) : undefined;
}

/** What math is meaningful on a numeric column, given the chosen revenue metric. */
export function metricKind(p: ColumnProfile, revenue?: ColumnProfile): MetricKind {
  if (revenue && p.name === revenue.name) return "value";
  if (QTY_NAME.test(p.name) && !ATTRIBUTE_NAME.test(p.name)) return "quantity";
  if (VALUE_NAME.test(p.name) && !ATTRIBUTE_NAME.test(p.name) && !UNIT_PRICE_NAME.test(p.name)) return "value";
  return "attribute"; // unit price (when not the revenue metric), age, rating, %, score, year, id…
}

/** True when summing the column across rows is meaningful (a flow), false for per-row attributes. */
export function isAdditive(p: ColumnProfile, revenue?: ColumnProfile): boolean {
  const k = metricKind(p, revenue);
  return k === "value" || k === "quantity";
}

// A unit PRICE (price/MSRP/fee/wage) — comparing its average across groups and saying "close the gap"
// is nonsense: a cheaper product isn't an underperforming one. (Distinct from revenue/amount OUTCOMES,
// where a low-performing region/rep genuinely can be brought up.)
const UNIT_PRICE_ONLY = /\b(price|unit[_\s-]?price|msrp|list[_\s-]?price|sticker|fee|wage|salary|hourly|per[_\s-]?unit)\b/i;
export function isUnitPriced(name: string): boolean {
  return UNIT_PRICE_ONLY.test(name);
}

// A product/catalog dimension (model/SKU/brand/category) — it DEFINES what's being priced, so "average
// value differs by product" is a price tier, not a gap to close. Operational dimensions (region, rep,
// channel, store, segment) are NOT product dimensions, so their gaps stay actionable.
const PRODUCT_DIM = /\b(product|products|model|models|sku|item|items|service|services|plan|plans|brand|brands|category|categories|type|variant|variants|title|make|line|tier|package)\b/i;
export function isProductDimension(name: string): boolean {
  return PRODUCT_DIM.test(name);
}

/**
 * Should a group-comparison's "copy the leader / close the gap" framing be suppressed? Yes when the metric
 * is a unit price, or the dimension is the product itself — in both cases a higher average just means a
 * pricier product, not an opportunity. Kept for outcome metrics (revenue, score, rate) on operational
 * dimensions (region, rep, channel), where bringing the laggard up is real advice.
 */
export function isValueTautology(metricName: string, dimensionName: string): boolean {
  return isUnitPriced(metricName) || isProductDimension(dimensionName);
}
