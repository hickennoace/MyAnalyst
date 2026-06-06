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

    // 1. Headline summary — set the scene in one friendly sentence.
    const headlineKpi = ctx.kpis[0];
    insights.push({
      id: "ins-summary",
      kind: "summary",
      confidence: "high",
      cites: headlineKpi ? [headlineKpi.id] : [],
      text:
        `Here's what your ${labelDomain(ctx.domain)} data looks like: ${ctx.rowCount.toLocaleString()} rows ` +
        `and ${ctx.columns.length} columns` +
        (headlineKpi ? `. The number that jumps out most is ${headlineKpi.name} — ${headlineKpi.value}${headlineKpi.unit ? " " + headlineKpi.unit : ""}.` : "."),
    });

    // 2. Trends — is it really going somewhere, in plain words.
    for (const t of ctx.trends.slice(0, 2)) {
      const kpi = ctx.kpis.find((k) => k.id.includes(t.metric));
      const amt = pct(Math.abs(t.changePct));
      let text: string;
      if (t.direction === "up") text = `Good news — ${t.metric} has been climbing, up about ${amt} from start to finish (${fmt(t.from)} → ${fmt(t.to)}). It's worth figuring out what's working so you can keep it going.`;
      else if (t.direction === "down") text = `Heads up — ${t.metric} has been slipping, down about ${amt} over the period (${fmt(t.from)} → ${fmt(t.to)}). It's a good idea to look into why before it drops further.`;
      else text = `${t.metric} stayed pretty steady over the period (${fmt(t.from)} → ${fmt(t.to)}) — no real ups or downs to worry about.`;
      insights.push({
        id: `ins-trend-${t.metric}`,
        kind: "trend",
        confidence: Math.abs(t.changePct) > 0.05 ? "high" : "medium",
        cites: kpi ? [kpi.id] : [],
        text,
      });
    }

    // 3. Correlations — "these two move together", with an honest caveat.
    const strong = ctx.correlations.filter((c) => c.strength !== "weak").slice(0, 2);
    for (const c of strong) {
      const together = c.r > 0 ? `when ${c.a} goes up, ${c.b} usually goes up too` : `when ${c.a} goes up, ${c.b} usually goes down`;
      const sig = c.significant
        ? `This looks like a real connection, not just chance.`
        : `But it's weak enough that it might just be coincidence — don't lean on it yet.`;
      insights.push({
        id: `ins-corr-${c.a}-${c.b}`,
        kind: "correlation",
        confidence: c.significant ? (c.strength === "strong" ? "high" : "medium") : "low",
        cites: [`corr:${c.a}~${c.b}`],
        text:
          `${c.a} and ${c.b} tend to move together — ${together} (a ${c.strength} link, r = ${c.r.toFixed(2)}). ${sig} ` +
          `Just remember: moving together doesn't prove one causes the other.`,
      });
    }

    // 4. Regression — "if you nudge X, Y tends to follow".
    if (ctx.regression && ctx.regression.r2 > 0.1) {
      const r = ctx.regression;
      insights.push({
        id: "ins-regression",
        kind: "regression",
        confidence: r.significant ? (r.adjR2 > 0.5 ? "high" : "medium") : "low",
        cites: ["regression"],
        text:
          `${r.driver} seems to be a real lever for ${r.target}: as a rough rule, every extra 1 of ${r.driver} ` +
          `comes with about ${r.slope >= 0 ? "+" : ""}${fmt(r.slope)} ${r.target}. ` +
          `On its own, ${r.driver} explains roughly ${pct(r.adjR2)} of why ${r.target} moves` +
          (r.significant ? `, and the pattern is reliable enough to take seriously.` : `, but the pattern isn't reliable yet — treat it as a hint.`),
      });
    }

    // 4b. Forecast — where things are heading if nothing changes.
    if (ctx.forecast) {
      const f = ctx.forecast;
      const dir = f.changePct > 0.02 ? "keep rising" : f.changePct < -0.02 ? "keep falling" : "hold about steady";
      insights.push({
        id: "ins-forecast",
        kind: "trend",
        confidence: "medium",
        cites: ["forecast"],
        text:
          `If the recent pattern holds, ${f.metric} should ${dir} over the next ${f.horizon} period${f.horizon === 1 ? "" : "s"} — ` +
          `from about ${fmt(f.lastValue)} now to roughly ${fmt(f.projected)} (${f.changePct >= 0 ? "up" : "down"} about ${pct(Math.abs(f.changePct))}). ` +
          `It's a best guess based on the trend, so revisit it as new numbers come in.`,
      });
    }

    // 4c. Most common category value (e.g. top reason).
    const cat = ctx.categories[0];
    if (cat && cat.top[0]) {
      const top = cat.top[0];
      insights.push({
        id: `ins-cat-${cat.column}`,
        kind: "composition",
        confidence: top.pct >= 0.4 ? "high" : "medium",
        cites: [`category:${cat.column}`],
        text:
          `By far the most common ${cat.column} is "${top.value}" — it shows up in ${pct(top.pct)} of the rows ` +
          `(${top.count} of ${cat.total})` +
          (cat.top[1] ? `, with "${cat.top[1].value}" next at ${pct(cat.top[1].pct)}. ` : `. `) +
          `Since it's so common, that's a smart place to focus first.`,
      });
    }

    // 5. Outliers — a gentle "double-check these" nudge.
    for (const o of ctx.outliers.slice(0, 1)) {
      if (o.count > 0) {
        const ex = o.examples[0];
        insights.push({
          id: `ins-outlier-${o.column}`,
          kind: "outlier",
          confidence: "medium",
          cites: [`outlier:${o.column}`],
          text:
            `A few ${o.column} values look unusually high or low (${o.count} of them` +
            (ex ? `, the most extreme being ${fmt(ex.value)}` : "") +
            `). Odd values like these can quietly skew the averages, so it's worth a quick check on whether they're real or just typos.`,
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
