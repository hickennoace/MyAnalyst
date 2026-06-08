import type { ColumnProfile, DataStory, DomainGuess } from "./types";

// "What is this data?" — a heuristic analyzer that actually reads the columns,
// their roles, types and stats, plus the detected domain and (optional) user
// context, and writes a specific plain-language description: the likely
// industry/subject, what each ROW represents, what the COLUMNS hold, and what
// the data is used for. Keeps the dashboard's findings tied to the real subject.

interface IndustrySignal {
  industry: string;
  keys: string[]; // lowercase substrings hinting at this industry in column names
  purpose: string;
}

const INDUSTRIES: IndustrySignal[] = [
  { industry: "SaaS / subscriptions", keys: ["mrr", "arr", "churn", "signup", "subscription", "trial", "seats", "active user", "retention"], purpose: "track growth and retention and cut churn while growing recurring revenue" },
  { industry: "Marketing / advertising", keys: ["impression", "click", "ctr", "conversion", "campaign", "cpc", "cpm", "spend", "channel", "roas", "audience"], purpose: "see which channels and campaigns pay off so budget flows to what performs" },
  { industry: "E-commerce / retail", keys: ["order", "product", "sku", "units", "quantity", "cart", "discount", "category", "basket", "checkout"], purpose: "understand what sells, to whom, and how pricing and promotions move sales" },
  { industry: "Sales / revenue", keys: ["revenue", "sales", "deal", "pipeline", "lead", "quota", "region", "rep", "account"], purpose: "find what drives revenue and where to focus the sales effort" },
  { industry: "Human resources", keys: ["employee", "salary", "department", "tenure", "headcount", "attrition", "satisfaction", "hire", "payroll", "role", "level"], purpose: "understand pay, retention and how teams compare across the organization" },
  { industry: "Real estate", keys: ["sq ft", "sqft", "bedroom", "bathroom", "listing", "neighborhood", "rent", "property", "days on market"], purpose: "understand what drives property value and time on market" },
  { industry: "Finance / investing", keys: ["profit", "expense", "balance", "cash", "return", "portfolio", "asset", "yield", "interest", "margin"], purpose: "track financial performance and the factors behind returns and costs" },
  { industry: "Health / fitness", keys: ["calorie", "heart rate", "workout", "steps", "weight", "bmi", "sleep", "activity", "duration", "intensity"], purpose: "track activity and outcomes to see what actually improves results" },
  { industry: "Survey / feedback", keys: ["rating", "score", "response", "nps", "feedback", "satisfaction", "agree", "question", "respondent"], purpose: "understand what people think and which factors drive their responses" },
];

const DOMAIN_FALLBACK: Record<string, { industry: string; purpose: string }> = {
  "financial-timeseries": { industry: "Financial time-series", purpose: "track performance over time and anticipate where the numbers are heading" },
  "sales-operational": { industry: "Sales / operations", purpose: "see what drives results and where to focus" },
  marketing: { industry: "Marketing", purpose: "measure what's working and where to invest" },
  survey: { industry: "Survey / feedback", purpose: "understand what people think and why" },
  general: { industry: "General business", purpose: "find the patterns that matter and decide what to do about them" },
};

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function count(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

function compactNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: abs < 10 ? 2 : 0 }).format(n);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Guess what a single row represents, from the file name (e.g. "sales-orders.csv" → "order").
function entityFromName(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b(sample|cleaned|data|dataset|final|copy|export|report|the|my|raw|v\d+)\b/gi, "")
    .trim();
  const last = base.split(/\s+/).filter(Boolean).pop() ?? "";
  if (!last) return "record";
  let s = last.toLowerCase();
  if (/ies$/.test(s)) s = s.replace(/ies$/, "y");
  else if (/(ss|us|is)$/.test(s)) { /* keep as-is */ }
  else if (/s$/.test(s)) s = s.replace(/s$/, "");
  return s;
}

export function buildDataStory(
  name: string,
  rowCount: number,
  profiles: ColumnProfile[],
  domain: DomainGuess,
  userContext?: string
): DataStory {
  const colText = profiles.map((p) => p.name.toLowerCase()).join(" | ");

  // Score industries by how many signal keywords appear in the column names.
  let best: IndustrySignal | null = null;
  let bestScore = 0;
  for (const ind of INDUSTRIES) {
    const score = ind.keys.reduce((n, k) => (colText.includes(k) ? n + 1 : n), 0);
    if (score > bestScore) {
      bestScore = score;
      best = ind;
    }
  }
  const fallback = DOMAIN_FALLBACK[domain.domain] ?? DOMAIN_FALLBACK.general;
  const industry = best ? best.industry : fallback.industry;
  const purpose = best ? best.purpose : fallback.purpose;

  const metrics = profiles.filter((p) => p.role === "metric");
  const dims = profiles.filter((p) => p.role === "dimension");
  const timeCol = profiles.find((p) => p.role === "time");
  const entity = entityFromName(name);

  const sentences: string[] = [];

  // 1) What it is.
  sentences.push(`This looks like ${article(industry)} ${industry.toLowerCase()} dataset.`);

  // 2) What a row is + the time span.
  let rowSentence = `Each of the ${rowCount.toLocaleString()} rows represents ${article(entity)} ${entity}`;
  if (timeCol?.dateRange) rowSentence += `, spanning ${fmtDate(timeCol.dateRange.min)} to ${fmtDate(timeCol.dateRange.max)}.`;
  else if (timeCol) rowSentence += `, recorded over time.`;
  else rowSentence += `.`;
  sentences.push(rowSentence);

  // 3) What the columns hold — measures + the main breakdown dimension.
  const structureBits: string[] = [];
  if (metrics.length) structureBits.push(count(metrics.length, "numeric measure"));
  if (dims.length) structureBits.push(count(dims.length, "category"));
  if (timeCol) structureBits.push("a date");
  if (structureBits.length) {
    let colSentence = `Across its ${profiles.length} columns it holds ${list(structureBits)}`;
    const leadDim = [...dims].sort((a, b) => b.distinctCount - a.distinctCount).find((d) => d.topValues && d.topValues.length);
    if (leadDim?.topValues?.length) {
      const examples = leadDim.topValues.slice(0, 3).map((v) => v.value).filter(Boolean);
      colSentence += ` — records split across ${leadDim.distinctCount} ${leadDim.name}${examples.length ? ` (e.g. ${list(examples)})` : ""}.`;
    } else {
      colSentence += `.`;
    }
    sentences.push(colSentence);
  }

  // 4) Range of the headline measure (gives a feel for scale).
  const lead = metrics.find((m) => m.numeric);
  if (lead?.numeric) {
    sentences.push(`${lead.name} ranges from ${compactNum(lead.numeric.min)} to ${compactNum(lead.numeric.max)}, averaging about ${compactNum(lead.numeric.mean)}.`);
  }

  // 5) Purpose — tailored to the user's stated goal when given.
  const ctx = userContext?.trim();
  if (ctx) {
    sentences.push(`You're using this to ${lowerFirst(ctx).replace(/\.$/, "")} — this analysis is framed around that goal.`);
  } else {
    sentences.push(`Data like this is typically used to ${purpose}.`);
  }

  return { industry, summary: sentences.join(" "), source: "heuristic" };
}

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
