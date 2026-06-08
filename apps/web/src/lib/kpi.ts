import type { BestSellers, ColumnProfile, Domain, Kpi, Table } from "./types";
import { numericColumn } from "./profile";
import { cagr, mean, std } from "./stats";
import { analyzeTimeSeries, trimPartialTail } from "./timeseries";
import { isAdditive, isTransactionGrain, metricKind, quantityMetric, revenueMetric } from "./semantics";

// KPI engine: given the typed table + profiles + domain, compute the headline numbers that matter.
// It leads with the business questions a manager actually has — total revenue, volume, average sale,
// and how revenue is trending — using metric SEMANTICS so it sums values (revenue, units) and only
// averages attributes (unit price, age, rating). Rules are keyed by role + meaning, not column names.

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}
function fmtCount(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

/** Headline label for the value metric: keep a value-named column's name, call a price-like one "revenue". */
function totalLabelFor(name: string): string {
  if (/revenue|sales|turnover|gmv|income|amount|spend|spending|cost|profit|bookings?/i.test(name)) {
    return /^total\b/i.test(name) ? name : `Total ${name}`;
  }
  return "Total revenue";
}

/** Pick the most "important" metric column: the revenue/value metric, else highest-total currency, else highest-variance. */
export function primaryMetric(profiles: ColumnProfile[]): ColumnProfile | undefined {
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  if (metrics.length === 0) return undefined;
  const revenue = revenueMetric(profiles, true);
  if (revenue) return revenue;
  const currency = metrics.filter((m) => m.type === "currency");
  if (currency.length)
    return [...currency].sort((a, b) => (b.numeric!.sum || 0) - (a.numeric!.sum || 0))[0];
  return [...metrics].sort((a, b) => (b.numeric!.std || 0) - (a.numeric!.std || 0))[0];
}

/** A rate/score/ratio metric whose AVERAGE is itself the KPI (satisfaction, conversion, margin %). */
function isRateLike(name: string): boolean {
  return /(\brate\b|ratio|\bscore\b|rating|csat|\bnps\b|satisfaction|margin|percent|%|conversion|\bctr\b|\bcpc\b|\broi\b|\baov\b|utilization|occupancy|accuracy|efficiency)/i.test(name);
}

/** A cost-of-goods column to net against revenue for gross margin (COGS, not opex/marketing spend). */
function costMetric(profiles: ColumnProfile[], revenue?: ColumnProfile): ColumnProfile | undefined {
  return profiles.find(
    (p) => p.role === "metric" && p.numeric && p.name !== revenue?.name && (p.numeric.sum ?? 0) > 0 && /\b(cogs|cost|costs|cost[_\s-]?of[_\s-]?goods)\b/i.test(p.name)
  );
}

export function computeKpis(table: Table, profiles: ColumnProfile[], domain: Domain, bestSellers?: BestSellers): Kpi[] {
  const kpis: Kpi[] = [];
  const timeCol = profiles.find((p) => p.role === "time");
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  const grain = isTransactionGrain(profiles, table.rowCount);
  const revenue = revenueMetric(profiles, grain, domain);
  const qty = quantityMetric(profiles, revenue);

  // ── Headline business KPIs: total revenue, volume, average sale, and revenue trend. ──
  if (revenue) {
    const n = revenue.numeric!;
    const isMoney = revenue.type === "currency";
    kpis.push({
      id: `kpi-total-${revenue.name}`,
      name: totalLabelFor(revenue.name),
      value: (isMoney ? fmtCurrency : fmtNum)(n.sum),
      unit: isMoney ? "USD" : undefined,
      howComputed: `Sum of ${revenue.name} across all ${fmtCount(table.rowCount)} rows.`,
      relevance: 1.0,
    });

    // Volume — units sold if there's a quantity column, otherwise the transaction count.
    if (qty) {
      kpis.push({
        id: `kpi-total-${qty.name}`,
        name: `Total ${qty.name}`,
        value: fmtCount(qty.numeric!.sum),
        howComputed: `Sum of ${qty.name} across all rows.`,
        relevance: 0.95,
      });
    } else {
      kpis.push({
        id: "kpi-volume",
        name: grain ? "Transactions" : "Records analyzed",
        value: fmtCount(table.rowCount),
        howComputed: grain ? "Number of transactions (one row per sale)." : "Total non-empty rows ingested.",
        relevance: 0.95,
      });
    }

    kpis.push({
      id: `kpi-avg-${revenue.name}`,
      name: `Average ${revenue.name}`,
      value: (isMoney ? fmtCurrency : fmtNum)(n.mean),
      unit: isMoney ? "USD" : undefined,
      howComputed: `Mean ${revenue.name} per row (median ${(isMoney ? fmtCurrency : fmtNum)(n.median)}).`,
      relevance: 0.8,
    });

    // Revenue trend — on revenue SUMMED PER MONTH (the honest version), not per-row noise. Monthly so a
    // dense stream of daily transactions reads as a real trend, and the incomplete final period is trimmed.
    const monthlyTs = timeCol ? analyzeTimeSeries(table, timeCol.name, revenue.name, "monthly") : undefined;
    if (monthlyTs) {
      const series = trimPartialTail(monthlyTs.periods.map((p) => p.value));
      if (series.length >= 2) {
        const last = series[series.length - 1];
        const yoy = series.length > 12;
        const base = yoy ? series[series.length - 13] : series[0];
        const chg = base !== 0 ? (last - base) / Math.abs(base) : NaN;
        if (Number.isFinite(chg)) {
          kpis.push({
            id: "kpi-revtrend",
            name: `${totalLabelFor(revenue.name)} ${yoy ? "(YoY)" : "trend"}`,
            value: `${(chg * 100).toFixed(1)}%`,
            trend: chg,
            howComputed: `Change in total ${revenue.name} per month ${yoy ? "versus a year earlier" : "from the first to the latest complete month"}.`,
            relevance: 0.9,
            spark: downsample(series, 40),
          });
        }
      }
    }

    // ── Derived KPIs that lead to a CONCLUSION, not just describe the data. ──

    // Gross margin — the single most decision-relevant number when costs are present.
    const cost = costMetric(profiles, revenue);
    if (cost && n.sum > 0) {
      const margin = (n.sum - cost.numeric!.sum) / n.sum;
      if (Number.isFinite(margin)) {
        kpis.push({
          id: "kpi-margin",
          name: "Gross margin",
          value: `${(margin * 100).toFixed(1)}%`,
          trend: margin,
          howComputed: `(total ${revenue.name} − total ${cost.name}) ÷ total ${revenue.name}.`,
          relevance: 0.92,
        });
      }
    }

    // Top performer — where the revenue actually concentrates (answers "what carries the business").
    if (bestSellers && bestSellers.topRevenue.revenueShare >= 0.15) {
      const t = bestSellers.topRevenue;
      kpis.push({
        id: "kpi-topseller",
        name: `Top ${bestSellers.dimension}`,
        value: `${t.name} · ${Math.round(t.revenueShare * 100)}%`,
        howComputed: `"${t.name}" is the largest ${bestSellers.dimension} by ${bestSellers.metric} — ${Math.round(t.revenueShare * 100)}% of the total.`,
        relevance: 0.86,
      });
    }

    // Peak period — when the business does its best, a hook for seasonality/planning.
    if (monthlyTs && monthlyTs.periods.length >= 4 && monthlyTs.best) {
      kpis.push({
        id: "kpi-bestmonth",
        name: "Best month",
        value: `${monthlyTs.best.label} · ${(isMoney ? fmtCurrency : fmtNum)(monthlyTs.best.value)}`,
        howComputed: `The single month with the highest total ${revenue.name}.`,
        relevance: 0.6,
      });
    }
  } else {
    kpis.push({
      id: "kpi-rows",
      name: "Records analyzed",
      value: fmtCount(table.rowCount),
      howComputed: "Total non-empty rows ingested.",
      relevance: 0.4,
    });
  }

  // ── Per-metric KPIs — but only the ones that lead somewhere. Sum flows (values, quantities). For
  //    attributes, surface the average ONLY when it's a real KPI (a rate/score like satisfaction) — a
  //    bare "Average customer age" is noise next to revenue, so it's dropped when a revenue headline
  //    exists. With no revenue, descriptive averages ARE the analysis, so they stay.
  for (const m of metrics) {
    if (m.name === revenue?.name || m.name === qty?.name) continue; // already a headline KPI
    const n = m.numeric!;
    const isMoney = m.type === "currency";
    const fmt = isMoney ? fmtCurrency : fmtNum;
    if (isAdditive(m, revenue)) {
      kpis.push({
        id: `kpi-total-${m.name}`,
        name: /^total\b/i.test(m.name) ? m.name : `Total ${m.name}`,
        value: fmt(n.sum),
        unit: isMoney ? "USD" : undefined,
        howComputed: `Sum of all ${m.name} values.`,
        relevance: isMoney ? 0.7 : 0.55,
      });
      continue;
    }
    // Attribute: keep its average only if it's a meaningful rate/score, or there's no revenue headline.
    if (isRateLike(m.name) || !revenue) {
      kpis.push({
        id: `kpi-avg-${m.name}`,
        name: `Average ${m.name}`,
        value: fmt(n.mean),
        unit: isMoney ? "USD" : undefined,
        howComputed: `Mean of ${m.name} (median ${fmt(n.median)}, σ = ${fmtNum(n.std)}).`,
        relevance: isRateLike(m.name) ? 0.62 : 0.4,
      });
    }
  }

  // ── Financial price-series KPIs (growth / CAGR / volatility / Sharpe) — only where summing is wrong
  //    and a price LEVEL over time is the story. Never applied to transaction data. ──
  if (domain === "financial-timeseries" && timeCol) {
    const pm = primaryMetric(profiles);
    if (pm) {
      const order = sortByTime(table, timeCol.name);
      const pmCol = numericColumn(table, pm.name);
      const series = order.map((i) => pmCol[i]).filter(Number.isFinite);
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
        if (Number.isFinite(g)) {
          kpis.push({
            id: `kpi-cagr-${pm.name}`,
            name: `${pm.name} per-period growth (CAGR)`,
            value: `${(g * 100).toFixed(2)}%`,
            trend: g,
            howComputed: `Compound growth rate of ${pm.name} across ${series.length} periods.`,
            relevance: 0.85,
          });
        }
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
