import type { Insight, InsightContext, InsightProvider } from "../types";

// Templated insight provider: turns the metadata-only InsightContext into grounded, plain-language
// conclusions. Every sentence is filled with numbers the local engine actually computed — so it can't
// hallucinate. This is the default "smart" narrator; an LLM provider can replace it behind the same interface.

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export class TemplatedInsightProvider implements InsightProvider {
  readonly name = "templated";
  lastSource: "llm" | "templated" = "templated";

  async generate(ctx: InsightContext): Promise<Insight[]> {
    this.lastSource = "templated";
    const insights: Insight[] = [];

    // 1. Headline summary.
    const headlineKpi = ctx.kpis[0];
    insights.push({
      id: "ins-summary",
      kind: "summary",
      confidence: "high",
      cites: headlineKpi ? [headlineKpi.id] : [],
      text:
        `This ${labelDomain(ctx.domain)} dataset has ${ctx.rowCount.toLocaleString()} records across ` +
        `${ctx.columns.length} fields` +
        (headlineKpi ? `. The standout figure is ${headlineKpi.name}: ${headlineKpi.value}${headlineKpi.unit ? " " + headlineKpi.unit : ""}.` : "."),
    });

    // 2. Trends.
    for (const t of ctx.trends.slice(0, 2)) {
      const dir = t.direction === "up" ? "increased" : t.direction === "down" ? "decreased" : "stayed roughly flat";
      const kpi = ctx.kpis.find((k) => k.id.includes(t.metric));
      insights.push({
        id: `ins-trend-${t.metric}`,
        kind: "trend",
        confidence: Math.abs(t.changePct) > 0.05 ? "high" : "medium",
        cites: kpi ? [kpi.id] : [],
        text:
          `${t.metric} ${dir} ${pct(Math.abs(t.changePct))} over the observed period ` +
          `(${fmt(t.from)} → ${fmt(t.to)})` +
          (t.direction === "up" ? " — worth understanding what's driving the growth." :
           t.direction === "down" ? " — this decline may warrant attention." : "."),
      });
    }

    // 3. Correlations.
    const strong = ctx.correlations.filter((c) => c.strength !== "weak").slice(0, 2);
    for (const c of strong) {
      const sign = c.r > 0 ? "positively" : "negatively";
      insights.push({
        id: `ins-corr-${c.a}-${c.b}`,
        kind: "correlation",
        confidence: c.strength === "strong" ? "high" : "medium",
        cites: [`corr:${c.a}~${c.b}`],
        text:
          `${c.a} and ${c.b} are ${c.strength}ly ${sign} correlated (r = ${c.r.toFixed(2)}). ` +
          (c.r > 0
            ? `When ${c.a} rises, ${c.b} tends to rise too.`
            : `When ${c.a} rises, ${c.b} tends to fall.`) +
          " Correlation isn't causation — treat this as a lead, not a conclusion.",
      });
    }

    // 4. Regression.
    if (ctx.regression && ctx.regression.r2 > 0.2) {
      const r = ctx.regression;
      insights.push({
        id: "ins-regression",
        kind: "regression",
        confidence: r.r2 > 0.6 ? "high" : "medium",
        cites: ["regression"],
        text:
          `A simple model of ${r.target} against ${r.driver} explains ${pct(r.r2)} of its variation ` +
          `(R² = ${r.r2.toFixed(2)}). Each unit increase in ${r.driver} is associated with a ` +
          `${r.slope >= 0 ? "+" : ""}${fmt(r.slope)} change in ${r.target}.`,
      });
    }

    // 4b. Forecast.
    if (ctx.forecast) {
      const f = ctx.forecast;
      const dir = f.changePct > 0.02 ? "rise" : f.changePct < -0.02 ? "fall" : "hold roughly steady";
      insights.push({
        id: "ins-forecast",
        kind: "trend",
        confidence: "medium",
        cites: ["forecast"],
        text:
          `Projecting ${f.metric} ${f.horizon} period${f.horizon === 1 ? "" : "s"} ahead (Holt's linear trend), ` +
          `it is expected to ${dir} from ${fmt(f.lastValue)} to about ${fmt(f.projected)} ` +
          `(${f.changePct >= 0 ? "+" : ""}${pct(f.changePct)}). Forecasts assume the recent trend continues.`,
      });
    }

    // 5. Outliers.
    for (const o of ctx.outliers.slice(0, 1)) {
      if (o.count > 0) {
        const ex = o.examples[0];
        insights.push({
          id: `ins-outlier-${o.column}`,
          kind: "outlier",
          confidence: "medium",
          cites: [`outlier:${o.column}`],
          text:
            `${o.column} contains ${o.count} unusual value${o.count === 1 ? "" : "s"} ` +
            `(beyond 3σ from the mean)` +
            (ex ? `, the most extreme being ${fmt(ex.value)} (z = ${ex.z.toFixed(1)})` : "") +
            ". These may be data-entry errors or genuinely notable events worth a closer look.",
        });
      }
    }

    return insights;
  }
}

function labelDomain(d: InsightContext["domain"]): string {
  switch (d) {
    case "financial-timeseries": return "financial time-series";
    case "sales-operational": return "sales / operational";
    case "marketing": return "marketing";
    case "survey": return "survey";
    default: return "general";
  }
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}
