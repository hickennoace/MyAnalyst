import type { ActionItem, ColumnProfile, DataQuality, InsightContext } from "./types";
import { currencySymbol } from "./currency";

// The "action report": a ranked, quantified list of concrete next steps derived from the computed
// analysis — the thing a consultant charges to write, generated instantly and grounded in real numbers.
// Each action sizes the opportunity where it can (e.g. "worth ~$203K"), so it reads like advice, not a
// chart. Pure, deterministic, worker-safe.

function fmtVal(n: number, p?: ColumnProfile): string {
  if (!Number.isFinite(n)) return "—";
  if (p?.type === "currency") {
    const sym = currencySymbol();
    const abs = Math.abs(n);
    if (abs >= 1e6) return sym + (n / 1e6).toFixed(1) + "M";
    if (abs >= 1e4) return sym + (n / 1e3).toFixed(0) + "K";
    return sym + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  }
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e4) return (n / 1e3).toFixed(1) + "K";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

export function buildActionReport(ctx: InsightContext, quality: DataQuality | undefined, profiles: ColumnProfile[]): ActionItem[] {
  const out: { a: ActionItem; score: number }[] = [];
  const prof = (name: string) => profiles.find((p) => p.name === name);
  const fmt = (n: number, name?: string) => fmtVal(n, name ? prof(name) : undefined);

  // 0. Double down on what sells — concrete, revenue-first, and the first move any operator wants.
  if (ctx.bestSellers) {
    const b = ctx.bestSellers;
    const same = b.topRevenue.name === b.topUnits.name;
    const laggards = b.byRevenue.filter((p) => p.revenueShare < 0.05).length;
    out.push({
      score: 0.95,
      a: {
        id: `act-bestseller-${b.dimension}`,
        title: same
          ? `Protect and grow your top ${b.dimension}, "${b.topRevenue.name}"`
          : `Push volume on "${b.topUnits.name}" and margin on "${b.topRevenue.name}"`,
        detail: same
          ? `"${b.topRevenue.name}" drives ${Math.round(b.topRevenue.revenueShare * 100)}% of revenue (${fmt(b.topRevenue.revenue, b.metric)}) and leads on volume — keep it in stock, defend its pricing, and study why it wins.${laggards ? ` Meanwhile ${laggards} ${b.dimension}${laggards === 1 ? "" : "s"} barely move — cut or relaunch them.` : ""}`
          : `"${b.topRevenue.name}" earns the most (${fmt(b.topRevenue.revenue, b.metric)}, ${Math.round(b.topRevenue.revenueShare * 100)}% of revenue) while "${b.topUnits.name}" sells the most volume. Use "${b.topUnits.name}" to win traffic and upsell toward "${b.topRevenue.name}" for margin.${laggards ? ` ${laggards} ${b.dimension}${laggards === 1 ? "" : "s"} contribute almost nothing — cut or fix them.` : ""}`,
        impact: "high",
        basis: `Best-seller analysis of ${b.metric} by ${b.dimension}`,
      },
    });
  }

  // 1. Biggest group gap — sized as an opportunity ("bring the laggard up to the leader is worth ~$X").
  //    Suppressed for unit-price / product-dimension comparisons (raising a cheap model's price to match a
  //    premium one is nonsense); kept for outcome×operational gaps (a region/rep that genuinely lags).
  const suppressed = new Set(ctx.suppressGroupComparisons ?? []);
  for (const g of ctx.groupComparisons.filter((g) => g.significant && !suppressed.has(`${g.metric}~${g.dimension}`)).slice(0, 2)) {
    const uplift = (g.top.mean - g.bottom.mean) * g.bottom.n;
    if (uplift > 0 && g.top.name !== g.bottom.name) {
      out.push({
        score: 0.9 * g.etaSq + 0.3,
        a: {
          id: `act-gap-${g.dimension}-${g.metric}`,
          title: `Close the ${g.metric} gap across ${g.dimension}`,
          detail: `"${g.bottom.name}" averages ${fmt(g.bottom.mean, g.metric)} vs "${g.top.name}" at ${fmt(g.top.mean, g.metric)}. Bringing "${g.bottom.name}" up to the leader is worth about ${fmt(uplift, g.metric)} across its ${g.bottom.n.toLocaleString()} records.`,
          impact: g.etaSq > 0.14 ? "high" : g.etaSq > 0.06 ? "medium" : "low",
          basis: `Group comparison (ANOVA) of ${g.metric} by ${g.dimension}`,
        },
      });
    }
  }

  // 2. The biggest lever — the strongest independent driver of the primary metric.
  if (ctx.drivers?.drivers?.length && ctx.drivers.r2 >= 0.1) {
    const ranked = [...ctx.drivers.drivers].filter((d) => d.significant).sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));
    const top = ranked[0];
    if (top) {
      out.push({
        score: 0.85 * Math.min(1, Math.abs(top.beta)) + 0.2,
        a: {
          id: `act-driver-${top.name}`,
          title: `Pull the biggest lever on ${ctx.drivers.target}: ${top.name}`,
          detail: `${top.name} is the strongest independent driver of ${ctx.drivers.target} (standardized effect β=${top.beta.toFixed(2)}; the model explains ${Math.round(ctx.drivers.r2 * 100)}% of the variation). Moving ${top.name} should shift ${ctx.drivers.target} ${top.beta >= 0 ? "up" : "down"} more than anything else here.`,
          impact: Math.abs(top.beta) > 0.4 ? "high" : "medium",
          basis: `Multiple-regression driver analysis on ${ctx.drivers.target}`,
        },
      });
    }
  }

  // 3. Reverse a real decline before it compounds.
  for (const t of ctx.trends.filter((t) => t.significant && t.direction === "down").slice(0, 1)) {
    out.push({
      score: 0.7 + Math.min(0.2, Math.abs(t.changePct)),
      a: {
        id: `act-trend-${t.metric}`,
        title: `Reverse the decline in ${t.metric}`,
        detail: `${t.metric} is trending down ${Math.abs(t.changePct * 100).toFixed(1)}% (${fmt(t.from, t.metric)} → ${fmt(t.to, t.metric)}). Find what changed over this period and act before it compounds.`,
        impact: Math.abs(t.changePct) > 0.1 ? "high" : "medium",
        basis: `Significant time trend of ${t.metric}`,
      },
    });
  }

  // 4. Get ahead of the forecast.
  if (ctx.forecast && Math.abs(ctx.forecast.changePct) > 0.05) {
    const up = ctx.forecast.changePct > 0;
    out.push({
      score: 0.5 + Math.min(0.15, Math.abs(ctx.forecast.changePct)),
      a: {
        id: "act-forecast",
        title: `Plan for ${ctx.forecast.metric} to ${up ? "rise" : "fall"}`,
        detail: `The projection puts ${ctx.forecast.metric} at ~${fmt(ctx.forecast.projected, ctx.forecast.metric)} over the next ${ctx.forecast.horizon} periods (${up ? "+" : ""}${(ctx.forecast.changePct * 100).toFixed(1)}% vs now). ${up ? "Make sure capacity and stock keep up." : "Get ahead of the drop now rather than reacting later."}`,
        impact: "medium",
        basis: `Forecast of ${ctx.forecast.metric}`,
      },
    });
  }

  // 5. Concentration risk on a MEASURE — a few categories carry most of the value (revenue, volume…).
  //    Stronger and more actionable than the row-count version below, so it takes precedence.
  const conc = ctx.concentration?.find((c) => c.level === "high") ?? ctx.concentration?.find((c) => c.level === "moderate" && !c.metricIsCount);
  let addedMeasureConc = false;
  if (conc && !conc.metricIsCount) {
    addedMeasureConc = true;
    out.push({
      score: 0.5 + (conc.level === "high" ? 0.25 : 0.1) + conc.topShare * 0.15,
      a: {
        id: `act-conc-${conc.dimension}-${conc.metric}`,
        title: `De-risk your dependence on a few ${conc.dimension}s`,
        detail: `The top ${conc.paretoCount} ${conc.dimension}${conc.paretoCount === 1 ? "" : "s"} drive ${Math.round(conc.paretoShare * 100)}% of ${conc.metric}, and "${conc.segments[0].name}" alone is ${Math.round(conc.segments[0].share * 100)}% (Gini ${conc.gini.toFixed(2)}). Protect those accounts and grow the long tail so the business isn't hostage to a handful of ${conc.dimension}s.`,
        impact: conc.level === "high" ? "high" : "medium",
        basis: `Concentration (Pareto) of ${conc.metric} by ${conc.dimension}`,
      },
    });
  }

  // 5b. Concentration risk — one categorical value dominates the row count (e.g. most tickets are Support).
  const cat = ctx.categories[0];
  if (!addedMeasureConc && cat && cat.top[0] && cat.top[0].pct >= 0.5) {
    out.push({
      score: 0.45 + cat.top[0].pct * 0.2,
      a: {
        id: `act-conc-${cat.column}`,
        title: `Reduce reliance on "${cat.top[0].value}"`,
        detail: `"${cat.top[0].value}" accounts for ${Math.round(cat.top[0].pct * 100)}% of ${cat.column} — a concentration risk. Diversify, or make sure that dependency is deliberate and protected.`,
        impact: cat.top[0].pct > 0.7 ? "high" : "medium",
        basis: `${cat.column} distribution`,
      },
    });
  }

  // 6. Fix the weakest data-quality dimension so every number above is trustworthy.
  if (quality) {
    const worst = quality.checks.filter((c) => c.status !== "good" && c.fix).sort((a, b) => a.score - b.score)[0];
    if (worst) {
      out.push({
        score: 0.35 + (1 - worst.score) * 0.3,
        a: {
          id: `act-quality-${worst.id}`,
          title: worst.fix!.replace(/\.$/, ""),
          detail: `${worst.detail} Fixing this makes every figure in this report more reliable.`,
          impact: quality.score < 60 ? "high" : "medium",
          basis: `Data quality — ${worst.label}`,
        },
      });
    }
  }

  return out
    .sort((x, y) => y.score - x.score)
    .slice(0, 5)
    .map((x) => x.a);
}
