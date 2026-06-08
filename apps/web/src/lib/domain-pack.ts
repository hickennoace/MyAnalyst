import type { ColumnProfile, Domain } from "./types";

// Domain packs: per-domain orientation and example questions, so the dashboard and the Ask box feel
// purpose-built for the kind of data uploaded. The example questions are built from the dataset's REAL
// columns (so they execute against the engine), but their selection/phrasing is tuned per domain.

/** A one-line "what to focus on" for this kind of data. */
export function domainFocus(domain: Domain): string {
  switch (domain) {
    case "financial-timeseries":
      return "Financial time series — focus on the trend, volatility, and what's projected next.";
    case "sales-operational":
      return "Sales & operations — focus on top products/regions, averages per order, and seasonality.";
    case "marketing":
      return "Marketing — focus on channel performance, what converts, and what drives response.";
    case "survey":
      return "Survey data — focus on the distribution of responses and differences between groups.";
    default:
      return "Focus on the biggest drivers, how groups differ, and any trend over time.";
  }
}

/** Up to 5 executable example questions, grounded in real columns but ordered/phrased per domain. */
export function domainSuggestions(domain: Domain, profiles: ColumnProfile[]): string[] {
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  const dims = profiles.filter((p) => p.role === "dimension");
  const time = profiles.find((p) => p.role === "time");
  const m = metrics[0]?.name;
  const m2 = metrics[1]?.name;
  const d = dims[0]?.name;
  // A column with enough distinct values to have a "vital few" story (a category or an entity id).
  const groupCol = profiles.find((p) => (p.role === "dimension" || p.role === "identifier") && p.distinctCount >= 4)?.name;
  // Transaction shape (a customer-ish id + a date + a value) → RFM "best customers" is answerable.
  const hasCustomer = profiles.some((p) => /customer|client|account|member|subscriber|user/i.test(p.name) && p.distinctCount >= 8);
  const rfmReady = hasCustomer && !!time && !!m;

  const out: string[] = [];
  const add = (s?: string | false) => {
    if (s && !out.includes(s)) out.push(s);
  };

  switch (domain) {
    case "financial-timeseries":
      if (time && m) add(`how did ${m} change over time`);
      if (m && m2) add(`correlation between ${m} and ${m2}`);
      if (m) add(`total ${m}`);
      if (d && m) add(`average ${m} by ${d}`);
      break;
    case "sales-operational":
      if (d && m) add(`which ${d} has the highest ${m}`);
      if (rfmReady) add(`who are my best customers`);
      if (m && groupCol) add(`how concentrated is ${m} across ${groupCol}`);
      if (m && d) add(`average ${m} by ${d}`);
      if (time && m) add(`how did ${m} change over time`);
      if (m && m2) add(`correlation between ${m} and ${m2}`);
      break;
    case "marketing":
      if (d && m) add(`which ${d} has the highest ${m}`);
      if (m && m2) add(`correlation between ${m} and ${m2}`);
      if (m && groupCol) add(`how concentrated is ${m} across ${groupCol}`);
      if (m && d) add(`average ${m} by ${d}`);
      if (time && m) add(`how did ${m} change over time`);
      break;
    case "survey":
      if (d) add(`most common ${d}`);
      if (m && d) add(`average ${m} by ${d}`);
      if (m) add(`average ${m}`);
      if (dims[1]) add(`breakdown of ${dims[1].name}`);
      break;
    default:
      if (m) add(`total ${m}`);
      if (m && d) add(`average ${m} by ${d}`);
      if (d && m) add(`which ${d} has the highest ${m}`);
      if (rfmReady) add(`who are my best customers`);
      if (m && groupCol) add(`how concentrated is ${m} across ${groupCol}`);
      if (m && m2) add(`correlation between ${m} and ${m2}`);
      if (time && m) add(`how did ${m} change over time`);
  }

  // Fallback so the box is never empty even on unusual schemas.
  if (m) add(`total ${m}`);
  if (m && d) add(`average ${m} by ${d}`);
  return out.slice(0, 5);
}
