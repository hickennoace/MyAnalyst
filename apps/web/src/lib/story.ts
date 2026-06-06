import type { ColumnProfile, DataStory, DomainGuess } from "./types";

// "What is this data?" — a lightweight analyzer that reads the columns, their
// roles and names, plus the detected domain, and writes a short plain-language
// description of the dataset's likely industry, subject and purpose. This keeps
// the dashboard's findings connected to the real-world subject of the data.

interface IndustrySignal {
  industry: string;
  // lowercase substrings that hint at this industry when found in column names
  keys: string[];
  purpose: string;
}

const INDUSTRIES: IndustrySignal[] = [
  { industry: "SaaS / subscriptions", keys: ["mrr", "arr", "churn", "signup", "subscription", "trial", "seats", "active users", "retention"], purpose: "track growth, retention and revenue so the team can reduce churn and grow recurring income" },
  { industry: "Marketing / advertising", keys: ["impression", "click", "ctr", "conversion", "campaign", "cpc", "cpm", "spend", "ad ", "channel", "roas"], purpose: "measure which channels and campaigns pay off, so budget goes where it performs" },
  { industry: "E-commerce / retail", keys: ["order", "product", "sku", "units", "quantity", "cart", "discount", "category", "basket"], purpose: "understand what sells, to whom, and how pricing and promotions move sales" },
  { industry: "Sales / revenue", keys: ["revenue", "sales", "deal", "pipeline", "lead", "quota", "region", "rep"], purpose: "see what drives revenue and where to focus the sales effort" },
  { industry: "Human resources", keys: ["employee", "salary", "department", "tenure", "headcount", "attrition", "satisfaction", "hire", "payroll"], purpose: "understand pay, retention and how teams compare across the organization" },
  { industry: "Real estate", keys: ["price", "sq ft", "sqft", "bedroom", "bathroom", "listing", "neighborhood", "rent", "property"], purpose: "understand what drives property value and time on market" },
  { industry: "Finance / investing", keys: ["profit", "expense", "balance", "cash", "return", "portfolio", "asset", "yield", "interest"], purpose: "track financial performance and the factors behind returns and costs" },
  { industry: "Health / fitness", keys: ["calorie", "heart rate", "workout", "steps", "weight", "bmi", "sleep", "activity", "duration"], purpose: "track activity and outcomes to see what improves results" },
  { industry: "Survey / feedback", keys: ["rating", "score", "response", "nps", "feedback", "satisfaction", "agree", "question"], purpose: "understand what people think and which factors drive their responses" },
];

const DOMAIN_FALLBACK: Record<string, { industry: string; purpose: string }> = {
  "financial-timeseries": { industry: "Financial time-series", purpose: "track performance over time and anticipate where the numbers are heading" },
  "sales-operational": { industry: "Sales / operations", purpose: "see what drives results and where to focus" },
  marketing: { industry: "Marketing", purpose: "measure what's working and where to invest" },
  survey: { industry: "Survey / feedback", purpose: "understand what people think and why" },
  general: { industry: "General business", purpose: "find the patterns that matter and what to do about them" },
};

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// Guess what a single row represents, from the file name (e.g. "sales-orders.csv" → "order").
function entityFromName(name: string): string {
  let base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b(sample|cleaned|data|dataset|final|copy|export|report|the|my)\b/gi, "")
    .trim();
  const last = base.split(/\s+/).filter(Boolean).pop() ?? "";
  if (!last) return "record";
  let s = last.toLowerCase();
  if (/ies$/.test(s)) s = s.replace(/ies$/, "y");
  else if (/(ss|us|is)$/.test(s)) { /* keep */ }
  else if (/s$/.test(s)) s = s.replace(/s$/, "");
  return s;
}

export function buildDataStory(
  name: string,
  rowCount: number,
  profiles: ColumnProfile[],
  domain: DomainGuess
): DataStory {
  const colText = profiles.map((p) => p.name.toLowerCase()).join(" | ");

  // Score industries by how many of their signal keywords appear in the columns.
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

  const metrics = profiles.filter((p) => p.role === "metric").map((p) => p.name);
  const dims = profiles.filter((p) => p.role === "dimension").map((p) => p.name);
  const hasTime = profiles.some((p) => p.role === "time");
  const entity = entityFromName(name);

  const sentences: string[] = [];
  sentences.push(
    `This looks like ${article(industry)} ${industry.toLowerCase()} dataset.`
  );
  sentences.push(
    `Each of the ${rowCount.toLocaleString()} rows represents ${article(entity)} ${entity}` +
      (hasTime ? ", recorded over time." : ".")
  );
  if (metrics.length) {
    sentences.push(
      `It mainly measures ${list(metrics.slice(0, 3))}` +
        (dims.length ? `, broken down by ${list(dims.slice(0, 2))}.` : ".")
    );
  }
  sentences.push(`Data like this is typically used to ${purpose}.`);

  return { industry, summary: sentences.join(" ") };
}
