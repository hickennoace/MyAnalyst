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
  { key: "healthcare", label: "Healthcare", context: "This is healthcare data — patients, diagnoses, treatments, admissions, length of stay, outcomes and cost." },
  { key: "education", label: "Education", context: "This is education data — students, courses, grades, scores, attendance, enrollment and completion rates." },
  { key: "manufacturing", label: "Manufacturing", context: "This is manufacturing / production data — output, units produced, defects, yield, downtime, throughput and cost." },
  { key: "logistics", label: "Logistics / supply chain", context: "This is logistics / supply-chain data — shipments, deliveries, lead time, on-time rate, inventory, warehouse and freight cost." },
  { key: "hospitality", label: "Hospitality / restaurants", context: "This is hospitality / restaurant data — bookings, covers, occupancy, average check, revenue, tips and table turnover." },
  { key: "banking", label: "Banking / lending", context: "This is banking / lending data — accounts, balance, transactions, loans, interest, default rate and deposits." },
  { key: "insurance", label: "Insurance", context: "This is insurance data — policies, premiums, claims, payouts, loss ratio, coverage and policyholders." },
  { key: "energy", label: "Energy / utilities", context: "This is energy / utilities data — consumption, usage (kWh), demand, generation, outages, tariffs and cost." },
  { key: "logistics_fleet", label: "Transport / fleet", context: "This is transport / fleet data — trips, distance, vehicles, drivers, fuel, utilization and on-time performance." },
  { key: "nonprofit", label: "Nonprofit / donations", context: "This is nonprofit / fundraising data — donors, donations, campaigns, gift amount, recurring giving and retention." },
  { key: "agriculture", label: "Agriculture", context: "This is agriculture data — crops, yield per acre, harvest, fields, inputs, weather and production cost." },
  { key: "gaming", label: "Gaming / apps", context: "This is gaming / app-analytics data — players, sessions, DAU, retention, in-app purchases, revenue and engagement." },
  { key: "media", label: "Media / streaming", context: "This is media / streaming data — views, watch time, subscribers, churn, engagement, content and revenue." },
  { key: "telecom", label: "Telecom", context: "This is telecom data — subscribers, ARPU, churn, usage, plans, calls, data and network." },
  { key: "automotive", label: "Automotive sales", context: "This is automotive sales data — vehicles, model, make, dealer, price, units sold, margin and inventory." },
  { key: "travel", label: "Travel / airlines", context: "This is travel / airline data — bookings, passengers, routes, load factor, fares, revenue and on-time rate." },
  { key: "construction", label: "Construction / projects", context: "This is construction / project data — projects, budget, cost, schedule, milestones, labor hours and completion." },
  { key: "sports", label: "Sports analytics", context: "This is sports analytics data — players, games, scores, points, wins, performance metrics and rankings." },
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
