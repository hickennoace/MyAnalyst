// Industry tags the user can attach to *their own uploaded file* so the analysis understands what it's
// looking at. The chosen tag is folded into the analysis context (userContext), which (a) biases
// rule-based domain detection — detectDomain scores a domain higher when its keywords appear in the
// context — and (b) frames the LLM story/insights. Each `context` phrase therefore deliberately contains
// the keywords detectDomain matches on. This is independent of the "or by industry" SAMPLE buttons,
// which only generate showcase datasets and are unaffected.

export interface IndustryTag {
  key: string;
  label: string;
  /** a natural sentence (rich in domain keywords) prepended to the user's context. */
  context: string;
}

export const INDUSTRY_TAGS: IndustryTag[] = [
  { key: "retail", label: "Retail sales", context: "This is retail sales data — revenue, orders, products, units and stores." },
  { key: "saas", label: "SaaS metrics", context: "This is SaaS subscription data — MRR, churn, signups, retention and active users." },
  { key: "ecommerce", label: "E-commerce orders", context: "This is e-commerce order data — orders, products, SKUs, quantity, units and customers." },
  { key: "marketing", label: "Marketing campaigns", context: "This is marketing campaign data — impressions, clicks, CTR, conversions, spend, channels and leads." },
  { key: "hr", label: "HR / people", context: "This is HR / people data — employees, salary, department, tenure, headcount and attrition." },
  { key: "realestate", label: "Real estate", context: "This is real estate data — listings, price, square footage, bedrooms, neighborhood and days on market." },
  { key: "fitness", label: "Fitness", context: "This is fitness / activity data — workouts, calories, heart rate, steps, duration and intensity." },
  { key: "survey", label: "Survey / NPS", context: "This is survey / feedback data — ratings, scores, NPS, responses, satisfaction and respondents." },
  { key: "finance", label: "Stock prices", context: "This is financial markets data — price, open, close, high, low, volume, returns and yield over time." },
];

/** The context phrase for a tag key, or "" when none / unknown. */
export function industryContext(key?: string | null): string {
  if (!key) return "";
  return INDUSTRY_TAGS.find((t) => t.key === key)?.context ?? "";
}

/** Combine an industry tag's phrase with the user's free-text context into one userContext string. */
export function combinedContext(industryKey: string | null | undefined, jobDesc: string): string | undefined {
  const merged = [industryContext(industryKey), jobDesc.trim()].filter(Boolean).join(" ");
  return merged || undefined;
}
