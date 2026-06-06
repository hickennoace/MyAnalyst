import type { ColumnProfile, Domain, Kpi, Table } from "./types";
import { numericColumn } from "./profile";
import { cagr, mean, std } from "./stats";

// KPI engine: given the typed table + profiles + domain, compute the headline numbers that matter.
// Rules are keyed by column ROLE (and domain), not by hard-coded column names, so it generalizes.

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

/** Pick the most "important" metric column: prefer the highest-total currency, then highest-variance numeric. */
export function primaryMetric(profiles: ColumnProfile[]): ColumnProfile | undefined {
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  if (metrics.length === 0) return undefined;
  const currency = metrics.filter((m) => m.type === "currency");
  if (currency.length)
    return [...currency].sort((a, b) => (b.numeric!.sum || 0) - (a.numeric!.sum || 0))[0];
  return [...metrics].sort((a, b) => (b.numeric!.std || 0) - (a.numeric!.std || 0))[0];
}

export function computeKpis(table: Table, profiles: ColumnProfile[], domain: Domain): Kpi[] {
  const kpis: Kpi[] = [];
  const timeCol = profiles.find((p) => p.role === "time");
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);

  // Always-useful structural KPIs.
  kpis.push({
    id: "kpi-rows",
    name: "Records analyzed",
    value: table.rowCount,
    howComputed: "Total non-empty rows ingested.",
    relevance: 0.4,
  });

  for (const m of metrics) {
    const n = m.numeric!;
    const isMoney = m.type === "currency";
    const fmt = isMoney ? fmtCurrency : fmtNum;

    // Sum is meaningful for additive metrics (money, quantities), not for ratios/prices-over-time.
    const additive = isMoney || /(qty|quantity|units|count|orders|volume|sales|spend|revenue)/i.test(m.name);
    if (additive) {
      kpis.push({
        id: `kpi-total-${m.name}`,
        name: `Total ${m.name}`,
        value: fmt(n.sum),
        unit: isMoney ? "USD" : undefined,
        howComputed: `Sum of all ${m.name} values.`,
        relevance: isMoney ? 0.95 : 0.75,
      });
    }

    kpis.push({
      id: `kpi-avg-${m.name}`,
      name: `Average ${m.name}`,
      value: fmt(n.mean),
      unit: isMoney ? "USD" : undefined,
      howComputed: `Mean of ${m.name} (median ${fmt(n.median)}, σ = ${fmtNum(n.std)}).`,
      relevance: 0.6,
    });
  }

  // Variability of the primary metric — how consistent the data is (coefficient of variation).
  const pmSpread = primaryMetric(profiles);
  if (pmSpread?.numeric && pmSpread.numeric.mean !== 0) {
    const cv = pmSpread.numeric.std / Math.abs(pmSpread.numeric.mean);
    if (Number.isFinite(cv)) {
      kpis.push({
        id: `kpi-cv-${pmSpread.name}`,
        name: `${pmSpread.name} variability`,
        value: `${(cv * 100).toFixed(0)}%`,
        howComputed: `Coefficient of variation (σ ÷ mean) — higher means less consistent ${pmSpread.name}.`,
        relevance: 0.55,
      });
    }
  }

  // Time-series KPIs: growth & volatility of the primary metric over the time axis.
  const pm = primaryMetric(profiles);
  if (timeCol && pm) {
    const order = sortByTime(table, timeCol.name);
    const series = order.map((i) => numericColumn(table, pm.name)[i]).filter(Number.isFinite);
    if (series.length >= 2) {
      const first = series[0];
      const last = series[series.length - 1];
      const totalGrowth = first !== 0 ? (last - first) / Math.abs(first) : NaN;
      if (Number.isFinite(totalGrowth)) {
        kpis.push({
          id: `kpi-growth-${pm.name}`,
          name: `${pm.name} change`,
          value: `${(totalGrowth * 100).toFixed(1)}%`,
          trend: totalGrowth,
          howComputed: `Change in ${pm.name} from first to last period (${fmtNum(first)} → ${fmtNum(last)}).`,
          relevance: 0.9,
          spark: downsample(series, 40),
        });
      }

      const g = cagr(first, last, series.length - 1);
      if (Number.isFinite(g) && (domain === "financial-timeseries" || domain === "sales-operational")) {
        kpis.push({
          id: `kpi-cagr-${pm.name}`,
          name: `${pm.name} per-period growth (CAGR)`,
          value: `${(g * 100).toFixed(2)}%`,
          trend: g,
          howComputed: `Compound growth rate of ${pm.name} across ${series.length} periods.`,
          relevance: 0.85,
        });
      }

      // Financial: period-over-period return volatility.
      if (domain === "financial-timeseries") {
        const rets: number[] = [];
        for (let i = 1; i < series.length; i++) {
          if (series[i - 1] !== 0) rets.push((series[i] - series[i - 1]) / series[i - 1]);
        }
        if (rets.length >= 2) {
          kpis.push({
            id: `kpi-vol-${pm.name}`,
            name: `${pm.name} volatility`,
            value: `${(std(rets) * 100).toFixed(2)}%`,
            howComputed: `Std. dev. of period-over-period returns of ${pm.name}.`,
            relevance: 0.8,
          });
          const avgRet = mean(rets);
          const sharpe = std(rets) !== 0 ? avgRet / std(rets) : NaN;
          if (Number.isFinite(sharpe)) {
            kpis.push({
              id: `kpi-sharpe-${pm.name}`,
              name: `${pm.name} risk-adjusted return`,
              value: sharpe.toFixed(2),
              howComputed: `Mean return ÷ return volatility (Sharpe-style, no risk-free rate).`,
              relevance: 0.7,
            });
          }
        }
      }
    }
  }

  return kpis.sort((a, b) => b.relevance - a.relevance);
}

/** Reduce a series to at most `max` evenly-spaced points (for compact sparklines). */
function downsample(series: number[], max: number): number[] {
  if (series.length <= max) return series;
  const step = series.length / max;
  const out: number[] = [];
  for (let i = 0; i < max; i++) out.push(series[Math.floor(i * step)]);
  return out;
}

/** Return row indices sorted ascending by the given time column. */
export function sortByTime(table: Table, timeCol: string): number[] {
  const keyed = table.rows.map((r, i) => {
    const d = new Date(String(r[timeCol]));
    return { i, t: Number.isNaN(d.getTime()) ? Number.POSITIVE_INFINITY : d.getTime() };
  });
  keyed.sort((a, b) => a.t - b.t);
  return keyed.map((k) => k.i);
}
