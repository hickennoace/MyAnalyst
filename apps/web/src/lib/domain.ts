import type { ColumnProfile, Domain, DomainGuess } from "./types";

// Rule-based domain detection from column names + roles. Cheap, deterministic, no LLM.
// Domain selects which KPIs and which charts are appropriate downstream.

const SIGNALS: { domain: Domain; words: RegExp; label: string }[] = [
  {
    domain: "financial-timeseries",
    words: /(price|close|open|high|low|return|volume|portfolio|asset|ticker|nav|yield|interest|balance|equity)/i,
    label: "price/return/volume columns over time",
  },
  {
    domain: "sales-operational",
    words: /(sales|revenue|order|quantity|units|product|customer|invoice|profit|margin|sku|region|store)/i,
    label: "sales/order/product columns",
  },
  {
    domain: "marketing",
    words: /(impression|click|ctr|conversion|campaign|channel|spend|cpc|cpm|roas|lead|session|bounce)/i,
    label: "campaign/click/conversion columns",
  },
  {
    domain: "survey",
    words: /(rating|score|response|question|satisfaction|nps|agree|likert|respondent|feedback)/i,
    label: "survey/rating/response columns",
  },
];

export function detectDomain(profiles: ColumnProfile[]): DomainGuess {
  const hasTime = profiles.some((p) => p.role === "time");
  const hasMetric = profiles.some((p) => p.role === "metric");

  const scores = SIGNALS.map((sig) => {
    const matches = profiles.filter((p) => sig.words.test(p.name)).length;
    let score = matches;
    if (sig.domain === "financial-timeseries" && hasTime) score += 1;
    return { ...sig, score, matches };
  }).sort((a, b) => b.score - a.score);

  const top = scores[0];
  if (top && top.score > 0) {
    const confidence = Math.min(0.95, 0.4 + top.score * 0.18);
    return {
      domain: top.domain,
      confidence,
      reason: `Detected ${top.label} (${top.matches} matching column${top.matches === 1 ? "" : "s"}).`,
    };
  }

  // Fall back: a time + metric table is still treated as a generic time series for charting.
  return {
    domain: "generic",
    confidence: hasTime && hasMetric ? 0.5 : 0.3,
    reason: hasTime
      ? "No strong domain keywords; treating as a generic time series."
      : "No strong domain keywords; treating as a generic tabular dataset.",
  };
}
