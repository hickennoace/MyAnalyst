import type { Insight, InsightContext, InsightProvider } from "../types";
import { currencySymbol } from "../currency";

// Templated insight provider: turns the metadata-only InsightContext into grounded,
// genuinely useful, plain-language findings. Every sentence is filled with numbers the
// engine actually computed — it can't hallucinate. This is the default narrator; an LLM
// can replace it behind the same interface. Ordered most-actionable first.

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
function conf(p: number): Insight["confidence"] {
  return p < 0.01 ? "high" : p < 0.05 ? "medium" : "low";
}
function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}
function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sym = currencySymbol();
  const abs = Math.abs(n);
  if (abs >= 1e6) return sym + (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return sym + (n / 1e3).toFixed(0) + "K";
  return sym + n.toFixed(0);
}

export class TemplatedInsightProvider implements InsightProvider {
  readonly name = "templated";
  lastSource: "llm" | "templated" = "templated";

  async generate(ctx: InsightContext): Promise<Insight[]> {
    this.lastSource = "templated";
    const out: Insight[] = [];

    // 1. Headline summary — the shape of the data in one line.
    const k = ctx.kpis[0];
    out.push({
      id: "ins-summary",
      kind: "summary",
      confidence: "high",
      cites: k ? [k.id] : [],
      text:
        `This ${labelDomain(ctx.domain)} dataset has ${ctx.rowCount.toLocaleString()} rows across ${ctx.columns.length} columns` +
        (k ? `. The headline figure is ${k.name}: ${k.value}${k.unit ? " " + k.unit : ""}.` : "."),
    });

    // 2. Best sellers — the first thing a sales dataset should answer: what drives the most revenue and
    //    the most volume (often different products). Leads, because it's the decisive business read.
    if (ctx.bestSellers) {
      const b = ctx.bestSellers;
      const sameLeader = b.topRevenue.name === b.topUnits.name;
      const volNoun = b.hasQuantity ? "units" : "sales";
      out.push({
        id: "ins-bestseller",
        kind: "composition",
        confidence: "high",
        cites: [`bestsellers:${b.dimension}`],
        text: sameLeader
          ? `"${b.topRevenue.name}" is your best-selling ${b.dimension} on both fronts — ${pct(b.topRevenue.revenueShare)} of revenue (${money(b.topRevenue.revenue)}) and ${pct(b.topUnits.unitShare)} of ${volNoun} (${fmt(b.topUnits.units)}). It's carrying the business; protect and grow it.`
          : `Your top ${b.dimension} by revenue is "${b.topRevenue.name}" — ${money(b.topRevenue.revenue)}, ${pct(b.topRevenue.revenueShare)} of the total — but by volume it's "${b.topUnits.name}" (${fmt(b.topUnits.units)} ${volNoun}, ${pct(b.topUnits.unitShare)}). The biggest seller and the biggest earner are different ${b.dimension}s, so grow each for a different reason: "${b.topUnits.name}" for reach, "${b.topRevenue.name}" for margin.`,
      });
    }

    // 3. Group differences (ANOVA) — "copy the leader" is real advice for an outcome (revenue, score)
    //    on an operational dimension (region, rep). It's nonsense for a unit price or a product dimension
    //    (a pricier model isn't an underperformer), so those comparisons are suppressed.
    const suppressed = new Set(ctx.suppressGroupComparisons ?? []);
    for (const g of ctx.groupComparisons.filter((g) => g.significant && !suppressed.has(`${g.metric}~${g.dimension}`)).slice(0, 2)) {
      out.push({
        id: `ins-anova-${g.metric}-${g.dimension}`,
        kind: "composition",
        confidence: conf(g.p),
        cites: [`anova:${g.metric}~${g.dimension}`],
        text:
          `${g.metric} depends a lot on ${g.dimension}: "${g.top.name}" leads at ${fmt(g.top.mean)} on average, while "${g.bottom.name}" trails at ${fmt(g.bottom.mean)} — ` +
          `that's a ${g.top.mean !== 0 || g.bottom.mean !== 0 ? pct(Math.abs((g.top.mean - g.bottom.mean) / (Math.abs(g.bottom.mean) || Math.abs(g.top.mean) || 1))) : "large"} gap and it's real, not luck. ` +
          `Figure out what "${g.top.name}" does differently and copy it across the rest.`,
      });
    }

    // 3. Driver analysis (multiple regression) — which factor truly moves the needle.
    if (ctx.drivers && ctx.drivers.fP < 0.05) {
      const sig = ctx.drivers.drivers.filter((d) => d.significant).sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));
      if (sig.length) {
        const lead = sig[0];
        const dead = ctx.drivers.drivers.filter((d) => !d.significant).map((d) => d.name);
        out.push({
          id: "ins-driver",
          kind: "regression",
          confidence: conf(lead.p),
          cites: ["drivers"],
          text:
            `Of all the factors, ${lead.name} is the real driver of ${ctx.drivers.target} — a one-standard-deviation rise in it shifts the outcome by about ${Math.abs(lead.beta).toFixed(2)} SD, more than any other factor even after accounting for them` +
            (dead.length ? `, while ${dead.slice(0, 2).join(" and ")} add little once ${lead.name} is considered.` : ".") +
            ` The factors together explain ${Math.round(ctx.drivers.r2 * 100)}% of ${ctx.drivers.target}'s variation, so put your effort into ${lead.name} for the most leverage.`,
        });
      }
    }

    // 4. Trends — real direction vs. noise.
    for (const t of ctx.trends.slice(0, 2)) {
      const kpi = ctx.kpis.find((kp) => kp.id.includes(t.metric));
      const amt = pct(Math.abs(t.changePct));
      let text: string;
      if (t.direction === "up") text = `${t.metric} is on a real climb — up about ${amt} from ${fmt(t.from)} to ${fmt(t.to)} across the period. Worth doubling down on whatever's driving it.`;
      else if (t.direction === "down") text = `${t.metric} is genuinely sliding — down about ${amt} (${fmt(t.from)} → ${fmt(t.to)}). Worth finding the cause before it drops further.`;
      else text = `${t.metric} held steady over the period (${fmt(t.from)} → ${fmt(t.to)}) — no real trend up or down.`;
      out.push({
        id: `ins-trend-${t.metric}`,
        kind: "trend",
        // Flat = not statistically real → low, so it's filtered out of the high-quality view.
        confidence: t.direction === "flat" ? "low" : t.significant ? "high" : "medium",
        cites: kpi ? [kpi.id] : [],
        text,
      });
    }

    // 5. Correlations — two numbers that move together (significant only stay after filtering).
    for (const c of ctx.correlations.filter((c) => c.strength !== "weak").slice(0, 2)) {
      out.push({
        id: `ins-corr-${c.a}-${c.b}`,
        kind: "correlation",
        confidence: c.significant ? (c.strength === "strong" ? "high" : "medium") : "low",
        cites: [`corr:${c.a}~${c.b}`],
        text:
          `${c.a} and ${c.b} move together: ${c.r > 0 ? `higher ${c.a} usually means higher ${c.b}` : `higher ${c.a} usually means lower ${c.b}`} (a ${c.strength} link, r = ${c.r.toFixed(2)}). ` +
          (c.significant ? `It's a real relationship — though moving together doesn't prove one causes the other.` : `It may be coincidence, so don't lean on it yet.`),
      });
    }

    // 5b. Concentration / Pareto — a vital few categories carrying most of a measure is a real finding
    //     (and often a risk). Only surface genuinely uneven distributions (the lib already gates on Gini).
    const conc = ctx.concentration?.find((c) => c.level !== "low");
    if (conc) {
      const measure = conc.metricIsCount ? "the records" : conc.metric;
      const biggest = conc.segments[0];
      out.push({
        id: `ins-conc-${conc.dimension}-${conc.metric}`,
        kind: "composition",
        confidence: conc.level === "high" ? "high" : "medium",
        cites: [`concentration:${conc.dimension}`],
        text:
          `A few ${conc.dimension}s carry most of ${measure}: the top ${conc.paretoCount} of ${conc.distinct} ` +
          `(${pct(conc.paretoPctOfCategories)}) account for ${pct(conc.paretoShare)}, and "${biggest.name}" alone is ${pct(biggest.share)}. ` +
          (conc.level === "high"
            ? `That dependence on a few ${conc.dimension}s is a risk worth managing — protect them and grow the long tail.`
            : `Worth knowing where the weight sits when you plan.`),
      });
    }

    // 6. Most common category value (e.g. the top reason / segment). Phrasing adapts to the ACTUAL
    //    distribution: only call it "dominates" when it really does, and only "a distant second" when
    //    there's a real gap — a near-even split is described as such, not over-claimed.
    const cat = ctx.categories[0];
    if (cat && cat.top[0]) {
      const top = cat.top[0];
      const second = cat.top[1];
      const lead = second ? top.pct - second.pct : top.pct; // gap in share between #1 and #2
      const dominant = top.pct >= 0.5;
      const strongLead = top.pct >= 0.4 && lead >= 0.15;
      const headVerb = dominant ? "dominates" : strongLead ? "leads" : "is the most common value in";
      let secondClause = ".";
      if (second) {
        secondClause =
          lead <= 0.03
            ? `, essentially tied with "${second.value}" (${pct(second.pct)}).`
            : lead <= 0.12
            ? `, just ahead of "${second.value}" (${pct(second.pct)}).`
            : `, with "${second.value}" a distant second at ${pct(second.pct)}.`;
      }
      const closer =
        dominant || strongLead
          ? ` Since it's so common, that's where action pays off first.`
          : ` No single value really stands out, so the split itself is the story.`;
      out.push({
        id: `ins-cat-${cat.column}`,
        kind: "composition",
        confidence: dominant || strongLead ? "high" : "medium",
        cites: [`category:${cat.column}`],
        text: `"${top.value}" ${headVerb} ${cat.column} — ${pct(top.pct)} of all rows (${top.count} of ${cat.total})` + secondClause + closer,
      });
    }

    // 7. Association between two categories (chi-square).
    const assoc = ctx.associations.find((a) => a.significant);
    if (assoc) {
      out.push({
        id: `ins-assoc-${assoc.a}-${assoc.b}`,
        kind: "correlation",
        confidence: conf(assoc.p),
        cites: [`assoc:${assoc.a}~${assoc.b}`],
        text:
          `${assoc.a} and ${assoc.b} are linked — certain ${assoc.a} values tend to come with certain ${assoc.b} values. Looking at them together reveals patterns you'd miss one at a time.`,
      });
    }

    // 8. Forecast — where it's heading if nothing changes.
    if (ctx.forecast) {
      const f = ctx.forecast;
      const dir = f.changePct > 0.02 ? "keep rising" : f.changePct < -0.02 ? "keep falling" : "stay about flat";
      out.push({
        id: "ins-forecast",
        kind: "trend",
        confidence: "medium",
        cites: ["forecast"],
        text:
          `If the recent pattern holds, ${f.metric} should ${dir} — from about ${fmt(f.lastValue)} now to roughly ${fmt(f.projected)} over the next ${f.horizon} period${f.horizon === 1 ? "" : "s"} (${f.changePct >= 0 ? "+" : ""}${pct(f.changePct)}). Plan around it and revisit as new data lands.`,
      });
    }

    // 9. Distribution shape & outliers. A skewed column (a premium price tier) is reported as SHAPE — use
    //    the median, not "check if these are errors". Only genuinely isolated points get the data-quality flag.
    const o = ctx.outliers[0];
    if (o && o.count > 0) {
      const ex = o.examples[0];
      if (o.kind === "skew" && o.median !== undefined && o.mean !== undefined) {
        const side = o.direction === "low" ? "low" : "high";
        out.push({
          id: `ins-skew-${o.column}`,
          kind: "outlier",
          confidence: "high",
          cites: [`outlier:${o.column}`],
          text:
            `${o.column} is ${side === "high" ? "right" : "left"}-skewed: most values sit near the median (${fmt(o.median)}), but a ${side}-end tail of ${o.count} pulls the average to ${fmt(o.mean)}. ` +
            `That tail is likely a real ${side === "high" ? "premium" : "low-end"} segment, not errors — use the median (${fmt(o.median)}) as the "typical" ${o.column}, and segment the tail rather than averaging it away.`,
        });
      } else {
        out.push({
          id: `ins-outlier-${o.column}`,
          kind: "outlier",
          confidence: "medium",
          cites: [`outlier:${o.column}`],
          text:
            `${o.column} has ${o.count} isolated extreme value${o.count === 1 ? "" : "s"}${ex ? ` (the most extreme is ${fmt(ex.value)})` : ""} that sit apart from the rest. ` +
            `A handful of points like these are often typos or glitches — worth checking they're real before trusting ${o.column}'s average.`,
        });
      }
    }

    return out.slice(0, 8);
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
