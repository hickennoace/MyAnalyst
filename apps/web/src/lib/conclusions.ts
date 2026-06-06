import type { Conclusion, InsightContext } from "./types";

// Conclusion engine — the "so what?" layer. The reasoning is statistically rigorous (significance
// tests, ANOVA, regression, chi-square, FDR correction) but the WORDING is plain English aimed at
// someone with no statistics background. The technical numbers live in each conclusion's optional
// `detail` line for those who want them. Still AI-generated, NOT professional advice (see DISCLAIMER).

export const DISCLAIMER =
  "These takeaways are written automatically by AI from your data. AI can get things wrong or miss the bigger picture, and a pattern in the data doesn't always mean one thing causes another. Use them as a helpful starting point — and for anything important (money, health, legal, or big business decisions), check with a qualified expert first.";

function pctTxt(x: number): string {
  return `${Math.round(x * 100)}%`;
}
function num(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 }).format(n);
}
function pTxt(p: number): string {
  if (!Number.isFinite(p)) return "p = n/a";
  return p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`;
}
function confFromP(p: number): Conclusion["confidence"] {
  return p < 0.01 ? "high" : p < 0.05 ? "medium" : "low";
}

type Draft = Omit<Conclusion, "id">;

export function deriveConclusions(ctx: InsightContext): Conclusion[] {
  const out: Draft[] = [];

  // 1. Group differences (ANOVA) — usually the most actionable.
  for (const g of ctx.groupComparisons.filter((g) => g.significant).slice(0, 2)) {
    out.push({
      confidence: confFromP(g.p),
      basis: `ANOVA ${g.metric} by ${g.dimension}`,
      text:
        `${g.metric} really does depend on the ${g.dimension}. "${g.top.name}" has the highest average ${g.metric} ` +
        `(about ${num(g.top.mean)}), while "${g.bottom.name}" has the lowest (about ${num(g.bottom.mean)}). ` +
        `This is a real difference, not random luck — so it's worth figuring out what makes "${g.top.name}" do better and copying it.`,
      detail: `The ${g.dimension} accounts for about ${pctTxt(g.etaSq)} of the differences in ${g.metric}. (ANOVA F = ${num(g.f)}, ${pTxt(g.p)}.)`,
    });
  }

  // 2. Categorical dominance — e.g. "the most common reason for not buying".
  for (const cat of ctx.categories.slice(0, 2)) {
    const top = cat.top[0];
    if (!top) continue;
    const second = cat.top[1];
    if (top.pct >= 0.5) {
      out.push({
        confidence: "high",
        basis: `${cat.column} frequency`,
        text:
          `"${top.value}" is by far the most common ${cat.column} — it shows up in ${pctTxt(top.pct)} of cases ` +
          `(${top.count} out of ${cat.total}). Because it's so common, dealing with it first will make the biggest difference.`,
      });
    } else if (top.pct >= 0.2) {
      const cover = second ? top.pct + second.pct : top.pct;
      out.push({
        confidence: "medium",
        basis: `${cat.column} frequency`,
        text:
          `The most common ${cat.column} is "${top.value}" (${pctTxt(top.pct)} of cases)` +
          (second ? `, followed by "${second.value}" (${pctTxt(second.pct)})` : "") +
          `. Just the top ${second ? "two" : "one"} already make up ${pctTxt(cover)} of everything, so that's where to focus first.`,
      });
    }
  }

  // 3. A real connection between two numbers (significant correlation).
  const sigCorr = ctx.correlations.find((c) => c.significant && c.strength !== "weak");
  if (sigCorr) {
    out.push({
      confidence: confFromP(sigCorr.p),
      basis: `correlation ${sigCorr.a}~${sigCorr.b}`,
      text:
        `When ${sigCorr.a} goes up, ${sigCorr.b} tends to go ${sigCorr.r > 0 ? "up" : "down"} too — there's a genuine connection between them. ` +
        `${sigCorr.a} might be something you can adjust to influence ${sigCorr.b}, but try a small change first to make sure it's really causing it and not just a coincidence.`,
      detail: `${sigCorr.strength === "strong" ? "Strong" : "Moderate"} link (correlation r = ${sigCorr.r.toFixed(2)}), measured on ${sigCorr.n} rows; very unlikely to be chance (${pTxt(sigCorr.p)}).`,
    });
  } else {
    const noisy = ctx.correlations.find((c) => !c.significant && Math.abs(c.r) > 0.25);
    if (noisy) {
      out.push({
        confidence: "low",
        basis: `correlation ${noisy.a}~${noisy.b}`,
        text:
          `${noisy.a} and ${noisy.b} look a little related, but it's weak enough that it could easily just be coincidence. ` +
          `Don't make decisions based on this one yet — you'd want more data to be sure.`,
        detail: `Apparent link r = ${noisy.r.toFixed(2)}, but it isn't statistically reliable (${pTxt(noisy.p)}, ${noisy.n} rows).`,
      });
    }
  }

  // 4a. Driver analysis (multiple regression) — which factor truly matters.
  if (ctx.drivers && ctx.drivers.fP < 0.05) {
    const d = ctx.drivers;
    const sig = d.drivers.filter((x) => x.significant).sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));
    const insig = d.drivers.filter((x) => !x.significant);
    if (sig.length) {
      const lead = sig[0];
      let text = `Out of all the factors, ${lead.name} has the biggest real effect on ${d.target}.`;
      if (insig.length)
        text += ` Interestingly, ${insig.map((i) => i.name).join(" and ")} ${insig.length === 1 ? "doesn't" : "don't"} actually add anything once you account for ${sig.map((s) => s.name).join(" and ")} — ${insig.length === 1 ? "it only" : "they only"} looked important because ${insig.length === 1 ? "it moves" : "they move"} alongside it.`;
      text += ` So focus your attention on ${lead.name}.`;
      out.push({
        confidence: confFromP(lead.p),
        basis: `multiple regression on ${d.target}`,
        text,
        detail: `Comparing all factors together, this model explains about ${pctTxt(d.adjR2)} of what drives ${d.target}. (${lead.name}: standardized effect ${lead.beta.toFixed(2)}, ${pTxt(lead.p)}.)`,
      });
    }
  }

  // 4b. Simple regression — only when there's no fuller driver analysis.
  if (ctx.regression && ctx.regression.significant && !ctx.drivers) {
    const r = ctx.regression;
    out.push({
      confidence: confFromP(r.slopeP),
      basis: "regression",
      text:
        `As a rough rule, every extra 1 of ${r.driver} comes with about ${r.slope >= 0 ? "+" : ""}${num(r.slope)} ${r.target}. ` +
        `That makes ${r.driver} a promising thing to adjust if you want to move ${r.target}.`,
      detail: `This relationship explains about ${pctTxt(r.adjR2)} of ${r.target}. (Slope ${num(r.slope)}, range ${num(r.ciLow)}–${num(r.ciHigh)}, ${pTxt(r.slopeP)}.)`,
    });
  }

  // 5. Trends — real trend vs. noise, in plain words.
  const t = ctx.trends.find((t) => t.direction !== "flat");
  if (t) {
    if (t.significant) {
      out.push({
        confidence: confFromP(t.slopeP ?? 0.05),
        basis: `trend ${t.metric}`,
        text:
          t.direction === "up"
            ? `${t.metric} is genuinely climbing over time (about ${pctTxt(Math.abs(t.changePct))} across the whole period) — this is a real upward trend, not just random ups and downs. Consider leaning into whatever's driving it.`
            : `${t.metric} is genuinely falling over time (about ${pctTxt(Math.abs(t.changePct))} across the whole period) — this is a real decline, not just random noise. Worth finding the cause before it gets worse.`,
        detail: `The trend is statistically reliable (${pTxt(t.slopeP ?? NaN)}).`,
      });
    } else {
      out.push({
        confidence: "low",
        basis: `trend ${t.metric}`,
        text:
          `${t.metric} bounced around (about ${pctTxt(Math.abs(t.changePct))} from start to finish), but there's no real upward or downward trend — it's mostly random movement. Don't read too much into it yet; wait for more data.`,
        detail: `No statistically reliable trend (${pTxt(t.slopeP ?? NaN)}).`,
      });
    }
  }

  // 6. Two categories that go together (chi-square association).
  const assoc = ctx.associations.find((a) => a.significant);
  if (assoc) {
    out.push({
      confidence: confFromP(assoc.p),
      basis: `association ${assoc.a}~${assoc.b}`,
      text:
        `${assoc.a} and ${assoc.b} are connected — knowing one tells you something about the other. Certain ${assoc.a} values tend to come with certain ${assoc.b} values. ` +
        `Looking at them together (instead of separately) may reveal useful patterns.`,
      detail: `${assoc.cramersV > 0.5 ? "Strong" : assoc.cramersV > 0.3 ? "Moderate" : "Mild"} connection (Cramér's V = ${assoc.cramersV.toFixed(2)}), very unlikely to be chance (${pTxt(assoc.p)}).`,
    });
  }

  // 7. Forecast.
  if (ctx.forecast && out.length < 6) {
    const f = ctx.forecast;
    out.push({
      confidence: "medium",
      basis: "forecast",
      text:
        `If things keep going the way they have been, ${f.metric} is heading toward about ${num(f.projected)} ` +
        `over the next ${f.horizon} period${f.horizon === 1 ? "" : "s"} (${f.changePct >= 0 ? "up" : "down"} about ${pctTxt(Math.abs(f.changePct))}). ` +
        `Plan around that, and update it as new numbers come in.`,
      detail: `Projection based on the recent trend (Holt's method).`,
    });
  }

  // 8. Outliers.
  const o = ctx.outliers[0];
  if (o && o.count > 0 && out.length < 6) {
    out.push({
      confidence: "medium",
      basis: `outliers in ${o.column}`,
      text:
        `A few ${o.column} values are unusually high or low (${o.count} of them). ` +
        `Oddball values like these can quietly throw off the averages, so it's worth checking whether they're real or just typos before trusting any ${o.column} numbers.`,
      detail: `${o.count} value${o.count === 1 ? "" : "s"} far outside the normal range (beyond 3 standard deviations).`,
    });
  }

  // Quality filter: surface only meaningful findings. Drop low-confidence
  // "probably just noise / just a hint" items — the user wants high-quality
  // answers, not hedged guesses.
  let kept = out.filter((c) => c.confidence !== "low");

  if (kept.length === 0) {
    kept.push({
      confidence: "medium",
      basis: "overview",
      text: "Nothing rose to a confident, reliable finding here. More rows — or a column that captures the outcome you care about — would help surface stronger patterns.",
    });
  }

  // Small-sample caveat still leads when relevant — it's a quality guard, not noise.
  if (ctx.smallSample) {
    kept.unshift({
      confidence: "low",
      basis: `sample size n = ${ctx.rowCount}`,
      text:
        `Heads up: you only have ${ctx.rowCount} rows of data, which is quite few. Treat everything below as rough hints rather than firm facts — the picture could easily change with more data.`,
    });
  }

  return kept.slice(0, 7).map((c, i) => ({ id: `concl-${i}`, ...c }));
}
