import type { ColumnProfile, Domain, DomainGuess } from "./types";
import { isTransactionGrain } from "./semantics";

// Rule-based domain detection from column names + roles + STRUCTURE. Cheap, deterministic, no LLM.
// Domain selects which KPIs and charts are appropriate downstream, so getting it right matters: a sales
// table with a "Price" (or "Cost") column must NOT be mistaken for a stock price-series, or the whole
// revenue analysis is disabled. The fix: "price/volume" alone are weak financial hints, and a stream of
// transactions (many repeating-category rows over time) is operational data, never a financial series.

// Real market-data structure — these strongly imply a financial price/return series.
const STRONG_FINANCIAL = /(\bclose\b|\bopen\b|\bhigh\b|\blow\b|ohlc|ticker|portfolio|\bnav\b|\byield\b|dividend|\bequity\b|adj[_\s-]?close|candlestick|drawdown|coupon|maturity|cusip|isin|sharpe)/i;
// Ambiguous: common in BOTH finance and ordinary sales — only count for finance on non-transaction data.
const WEAK_FINANCIAL = /(\bprice\b|\bvolume\b|\breturn\b|\bbalance\b|\basset\b|\binterest\b)/i;

const SALES = /(sales|revenue|orders?|quantity|\bqty\b|\bunits?\b|product|customer|client|invoice|profit|margin|\bsku\b|region|stores?|\bprice\b|\bcost\b|discount|brand|model|make|dealer|vendor|supplier|category|shipment|warehouse|inventory|payment|transaction|deal)/i;
const MARKETING = /(impression|click|\bctr\b|conversion|campaign|channel|spend|\bcpc\b|\bcpm\b|roas|\blead\b|session|bounce|audience|\breach\b|engagement)/i;
const SURVEY = /(rating|\bscore\b|response|question|satisfaction|\bnps\b|agree|likert|respondent|feedback|survey)/i;

export function detectDomain(profiles: ColumnProfile[], userContext?: string, rowCount?: number): DomainGuess {
  const hasTime = profiles.some((p) => p.role === "time");
  const hasMetric = profiles.some((p) => p.role === "metric");
  const grain = rowCount !== undefined && isTransactionGrain(profiles, rowCount);
  const context = (userContext ?? "").toLowerCase();
  const names = profiles.map((p) => p.name);
  const count = (re: RegExp) => names.filter((n) => re.test(n)).length;
  const ctxHit = (re: RegExp) => (context && re.test(context) ? 2 : 0);

  const strongFin = count(STRONG_FINANCIAL);
  const weakFin = count(WEAK_FINANCIAL);
  // Financial needs market structure: strong signals always count; weak ones (price/volume) only when the
  // data ISN'T a stream of transactions. The time bonus applies only when there's some financial signal.
  const finSignal = strongFin + weakFin;
  const financialScore = strongFin * 2 + (grain ? 0 : weakFin + (hasTime && finSignal > 0 ? 1 : 0)) + ctxHit(STRONG_FINANCIAL);

  // Operational/sales: keyword matches plus a structural bonus. The transaction-grain bonus only
  // REINFORCES a real sales signal — it must not invent "sales" from a keyword-less stream (e.g. a
  // fitness log: Date + Activity + Duration + Calories is a transaction grain but isn't sales/ops).
  const salesKw = count(SALES) + ctxHit(SALES);
  const salesScore = salesKw > 0 ? salesKw + (grain ? 1 : 0) : 0;
  const marketingScore = count(MARKETING) + ctxHit(MARKETING);
  const surveyScore = count(SURVEY) + ctxHit(SURVEY);

  const scored = [
    { domain: "sales-operational" as Domain, score: salesScore, label: "sales/order/product columns" },
    { domain: "financial-timeseries" as Domain, score: financialScore, label: "price/return/volume columns over time" },
    { domain: "marketing" as Domain, score: marketingScore, label: "campaign/click/conversion columns" },
    { domain: "survey" as Domain, score: surveyScore, label: "survey/rating/response columns" },
  ].sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (top && top.score > 0) {
    return {
      domain: top.domain,
      confidence: Math.min(0.95, 0.4 + top.score * 0.16),
      reason: `Detected ${top.label}.`,
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
