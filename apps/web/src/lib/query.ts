import type { ChartSpec, ColumnProfile, Table } from "./types";
import { numericColumn } from "./profile";
import { pearson } from "./stats";
import { aggregateCount, buildChart } from "./charts";
import { sortByTime } from "./kpi";

// ── AI-enhanced answers ────────────────────────────────────────────────────────
// When the optional LLM is enabled (NEXT_PUBLIC_LLM_ENABLED=1), `answerQuestionAI` keeps the exact
// numbers from the deterministic heuristic below but lets the model narrate a thorough, professional
// analyst answer grounded in pre-computed aggregates. Privacy: only aggregates/metadata cross the wire
// (the same boundary as /api/insights) — never raw rows. Any failure falls back to the heuristic answer.

export interface RichAnswer extends QueryAnswer {
  /** Which narrator produced the prose. */
  source: "llm" | "heuristic";
  /** Suggested next questions (LLM only). */
  followups?: string[];
}

const CATEGORY_HINT = /(reason|category|type|status|segment|group|class|gender|channel|source|outcome|result|stage|priority|label|tag|product|region|country|state|city|department)/i;

// "Ask your data" — a heuristic natural-language Q&A engine. No LLM, no key. It maps plain-English
// questions to exact computations over the local data (aggregates, group-bys, rankings, correlation,
// trends) and answers with the real numbers, optionally attaching a chart.

export interface QueryAnswer {
  ok: boolean;
  answer: string;
  chart?: ChartSpec;
}

type Agg = "sum" | "mean" | "max" | "min";

const AGG_WORDS: { agg: Agg; re: RegExp; label: string }[] = [
  { agg: "sum", re: /\b(total|sum|combined|altogether)\b/, label: "total" },
  { agg: "mean", re: /\b(average|avg|mean|typical)\b/, label: "average" },
  { agg: "max", re: /\b(max|maximum|highest|largest|biggest|most|peak)\b/, label: "maximum" },
  { agg: "min", re: /\b(min|minimum|lowest|smallest|least)\b/, label: "minimum" },
];

function resolveCols(text: string, cols: ColumnProfile[]): ColumnProfile[] {
  const lower = text.toLowerCase();
  return cols
    .filter((c) => lower.includes(c.name.toLowerCase()))
    .sort((a, b) => lower.indexOf(a.name.toLowerCase()) - lower.indexOf(b.name.toLowerCase()));
}

function fmt(n: number, profile?: ColumnProfile): string {
  if (!Number.isFinite(n)) return "—";
  if (profile?.type === "currency")
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

function aggregate(values: number[], agg: Agg): number {
  const xs = values.filter(Number.isFinite);
  if (xs.length === 0) return NaN;
  switch (agg) {
    case "sum": return xs.reduce((a, b) => a + b, 0);
    case "mean": return xs.reduce((a, b) => a + b, 0) / xs.length;
    case "max": return Math.max(...xs);
    case "min": return Math.min(...xs);
  }
}

/** Group a metric by a dimension under the given aggregator → sorted [key, value] pairs (desc). */
function groupBy(table: Table, dim: string, metric: string, agg: Agg): [string, number][] {
  const buckets = new Map<string, number[]>();
  const vals = numericColumn(table, metric);
  table.rows.forEach((r, i) => {
    if (!Number.isFinite(vals[i])) return;
    const key = String(r[dim] ?? "—");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(vals[i]);
  });
  return [...buckets.entries()]
    .map(([k, v]) => [k, aggregate(v, agg)] as [string, number])
    .sort((a, b) => b[1] - a[1]);
}

export function answerQuestion(question: string, table: Table, profiles: ColumnProfile[]): QueryAnswer {
  const text = question.trim();
  if (!text) return { ok: false, answer: 'Ask something like "total revenue by region" or "correlation between spend and revenue".' };
  const lower = text.toLowerCase();

  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  const dims = profiles.filter((p) => p.role === "dimension");
  const time = profiles.find((p) => p.role === "time");

  const mMetrics = resolveCols(text, metrics);
  const mDims = resolveCols(text, dims);

  // 1. Row count.
  if (/\b(how many|number of|count of|count)\b/.test(lower) && /\b(row|record|entr|data point|observation)/.test(lower)) {
    return { ok: true, answer: `There are ${table.rowCount.toLocaleString()} records in the dataset.` };
  }

  // 1b. Most-common / distribution of a CATEGORICAL column — e.g. "the most common reason for not buying".
  // Explicit frequency phrasing always counts; the "which <category>" shortcut only counts when no
  // metric is involved (otherwise "which region has the highest revenue" is a ranking, handled below).
  const explicitFreq = /\b(most common|commonest|most frequent|most popular|main reason|top reason|biggest reason|usual|distribution|breakdown|how often|frequency)\b/.test(lower);
  const wantsFreq = explicitFreq || (/\bwhich\b/.test(lower) && CATEGORY_HINT.test(lower) && mMetrics.length === 0);
  if (wantsFreq) {
    // Pick the category column: one named in the question, else a hinted dimension, else the first dimension.
    const col =
      mDims[0] ??
      dims.find((d) => CATEGORY_HINT.test(d.name) && CATEGORY_HINT.test(lower) && lower.includes(d.name.toLowerCase().split(/\s+/)[0])) ??
      dims.find((d) => CATEGORY_HINT.test(d.name)) ??
      dims[0];
    if (col) {
      const counts = aggregateCount(table, col.name);
      const total = counts.reduce((s, [, c]) => s + c, 0);
      if (total > 0) {
        const top = counts[0];
        const second = counts[1];
        return {
          ok: true,
          answer:
            `The most common ${col.name} is "${top[0]}" — ${top[1]} of ${total} (${Math.round((top[1] / total) * 100)}%)` +
            (second ? `, then "${second[0]}" (${Math.round((second[1] / total) * 100)}%).` : "."),
          chart: buildChart(table, profiles, { type: "bar", x: col.name, y: [], count: true }),
        };
      }
    }
  }

  // 2. Correlation / relationship.
  if (/correlat|relationship|related|associat|vs\.?|versus/.test(lower)) {
    const ms = mMetrics.length >= 2 ? mMetrics : metrics;
    if (ms.length >= 2) {
      const [a, b] = ms;
      const r = pearson(numericColumn(table, a.name), numericColumn(table, b.name));
      if (Number.isFinite(r)) {
        const strength = Math.abs(r) > 0.7 ? "strong" : Math.abs(r) > 0.4 ? "moderate" : "weak";
        const dir = r > 0 ? "positive" : "negative";
        return {
          ok: true,
          answer: `${a.name} and ${b.name} have a ${strength} ${dir} correlation (r = ${r.toFixed(2)}). ${
            Math.abs(r) > 0.4 ? "They tend to move together." : "The link is loose."
          }`,
          chart: buildChart(table, profiles, { type: "scatter", x: a.name, y: [b.name] }),
        };
      }
    }
  }

  // 3. Trend over time.
  if (time && /(trend|over time|timeline|change over|grow|growth|increase|decrease|trajectory)/.test(lower)) {
    const m = mMetrics[0] ?? metrics[0];
    if (m) {
      const order = sortByTime(table, time.name);
      const series = order.map((i) => numericColumn(table, m.name)[i]).filter(Number.isFinite);
      if (series.length >= 2) {
        const first = series[0];
        const last = series[series.length - 1];
        const pct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
        const dir = pct > 1 ? "increased" : pct < -1 ? "decreased" : "stayed roughly flat";
        return {
          ok: true,
          answer: `${m.name} ${dir} ${Math.abs(pct).toFixed(1)}% over the period (${fmt(first, m)} → ${fmt(last, m)}).`,
          chart: buildChart(table, profiles, { type: "line", x: time.name, y: [m.name] }),
        };
      }
    }
  }

  // 4. Ranking: "which region has the highest revenue", "top products by sales".
  if (/\b(which|top|highest|largest|best|lowest|bottom|worst|rank)\b/.test(lower)) {
    const dim = mDims[0] ?? dims[0];
    const metric = mMetrics[0] ?? metrics[0];
    if (dim && metric) {
      const aggMatch = AGG_WORDS.find((w) => w.re.test(lower));
      const agg: Agg = aggMatch?.agg === "mean" ? "mean" : "sum";
      const ranked = groupBy(table, dim.name, metric.name, agg);
      if (ranked.length) {
        const wantLowest = /\b(lowest|bottom|worst|smallest|least)\b/.test(lower);
        const ordered = wantLowest ? [...ranked].reverse() : ranked;
        const top = ordered[0];
        const aggLabel = agg === "mean" ? "average" : "total";
        return {
          ok: true,
          answer: `By ${aggLabel} ${metric.name}, ${dim.name} "${top[0]}" is ${wantLowest ? "lowest" : "highest"} at ${fmt(top[1], metric)}.`,
          chart: agg === "sum" ? buildChart(table, profiles, { type: "bar", x: dim.name, y: [metric.name], aggregate: true }) : undefined,
        };
      }
    }
  }

  // 5. Aggregate (optionally grouped): "total revenue", "average units by region".
  const aggMatch = AGG_WORDS.find((w) => w.re.test(lower));
  if (aggMatch) {
    const metric = mMetrics[0] ?? metrics[0];
    if (metric) {
      const wantsGroup = /\b(by|per|across|for each|grouped)\b/.test(lower);
      const dim = wantsGroup ? mDims[0] ?? dims[0] : undefined;
      if (dim) {
        const ranked = groupBy(table, dim.name, metric.name, aggMatch.agg);
        const top = ranked[0];
        return {
          ok: true,
          answer: `${cap(aggMatch.label)} ${metric.name} by ${dim.name}: ${dim.name} "${top[0]}" leads at ${fmt(top[1], metric)} (${ranked.length} groups).`,
          chart: aggMatch.agg === "sum" ? buildChart(table, profiles, { type: "bar", x: dim.name, y: [metric.name], aggregate: true }) : undefined,
        };
      }
      const v = aggregate(numericColumn(table, metric.name), aggMatch.agg);
      return { ok: true, answer: `The ${aggMatch.label} of ${metric.name} is ${fmt(v, metric)}.` };
    }
  }

  // 6. A bare metric mention → give its headline stats.
  if (mMetrics.length) {
    const m = mMetrics[0];
    const vals = numericColumn(table, m.name);
    return {
      ok: true,
      answer: `${m.name}: total ${fmt(aggregate(vals, "sum"), m)}, average ${fmt(aggregate(vals, "mean"), m)}, range ${fmt(aggregate(vals, "min"), m)}–${fmt(aggregate(vals, "max"), m)}.`,
    };
  }

  return {
    ok: false,
    answer:
      'I couldn\'t map that to your columns. Try: "total ' +
      (metrics[0]?.name ?? "value") +
      '", "average ' + (metrics[0]?.name ?? "value") + " by " + (dims[0]?.name ?? "category") +
      '", or "correlation between two metrics".',
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── AI path ────────────────────────────────────────────────────────────────────

const round2 = (n: number): number | null => (Number.isFinite(n) ? Math.round(n * 100) / 100 : null);

// The work-context the user optionally typed on the analyzer ("what this data is about"), stored
// locally. Threaded into the AI prompt so answers are framed around the user's actual goal.
const CONTEXT_KEY = "quantia:context";

/** Whether the optional server-side LLM narrator is switched on (the key itself stays server-side). */
function llmOn(): boolean {
  return typeof process !== "undefined" && process.env.NEXT_PUBLIC_LLM_ENABLED === "1";
}

function readUserContext(): string | undefined {
  try {
    if (typeof window === "undefined" || !window.localStorage) return undefined;
    const v = window.localStorage.getItem(CONTEXT_KEY);
    return v && v.trim() ? v.trim().slice(0, 400) : undefined;
  } catch {
    return undefined;
  }
}

function strengthLabel(r: number): string {
  const a = Math.abs(r);
  return a > 0.7 ? "strong" : a > 0.4 ? "moderate" : a > 0.2 ? "weak" : "negligible";
}

/** A rich, plain-number brief for one metric, reusing the already-computed NumericSummary. */
function metricBrief(p: ColumnProfile) {
  const n = p.numeric!;
  const cv = n.mean !== 0 ? Math.abs(n.std / n.mean) : null; // coefficient of variation (relative spread)
  const skew =
    n.median !== 0 && n.mean > n.median * 1.1
      ? "right-skewed (a few large values pull the average above the typical value)"
      : n.median !== 0 && n.mean < n.median * 0.9
      ? "left-skewed (a few small values pull the average down)"
      : "roughly symmetric";
  return {
    name: p.name,
    type: p.type,
    total: round2(n.sum),
    average: round2(n.mean),
    median: round2(n.median),
    min: round2(n.min),
    max: round2(n.max),
    stdDev: round2(n.std),
    spreadCV: cv === null ? null : round2(cv),
    shape: skew,
    fillRatePct: round2(p.fillRate * 100),
    count: n.count,
  };
}

/** Strongest pairwise correlations among the given metrics (capped for cost), ranked by |r|. */
function topCorrelations(table: Table, metrics: ColumnProfile[], limit: number) {
  const out: { a: string; b: string; r: number | null; r2: number | null; strength: string; direction: string }[] = [];
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const r = pearson(numericColumn(table, metrics[i].name), numericColumn(table, metrics[j].name));
      if (Number.isFinite(r)) {
        out.push({
          a: metrics[i].name,
          b: metrics[j].name,
          r: round2(r),
          r2: round2(r * r),
          strength: strengthLabel(r),
          direction: r > 0 ? "positive" : "negative",
        });
      }
    }
  }
  return out.sort((x, y) => Math.abs(y.r ?? 0) - Math.abs(x.r ?? 0)).slice(0, limit);
}

/** An always-on statistical brief of the WHOLE dataset, so even open-ended questions are grounded. */
function buildOverview(table: Table, profiles: ColumnProfile[]) {
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  const dims = profiles.filter((p) => p.role === "dimension");
  const time = profiles.find((p) => p.role === "time");
  const o: Record<string, unknown> = {};

  if (metrics.length) o.metrics = metrics.slice(0, 8).map(metricBrief);

  const corr = topCorrelations(table, metrics.slice(0, 8), 6);
  if (corr.length) o.correlations = corr;

  if (dims.length) {
    o.categories = dims.slice(0, 4).map((d) => {
      const counts = aggregateCount(table, d.name);
      const total = counts.reduce((s, [, c]) => s + c, 0);
      return {
        column: d.name,
        distinct: counts.length,
        top: counts.slice(0, 5).map(([value, count]) => ({ value, count, pct: total ? round2((count / total) * 100) : null })),
      };
    });
  }

  if (time && metrics[0]) {
    const order = sortByTime(table, time.name);
    const series = order.map((i) => numericColumn(table, metrics[0].name)[i]).filter(Number.isFinite);
    if (series.length >= 2) {
      const first = series[0];
      const last = series[series.length - 1];
      const pct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
      o.overallTrend = { metric: metrics[0].name, over: time.name, first: round2(first), last: round2(last), changePct: round2(pct), periods: series.length };
    }
  }

  return o;
}

/** Question-specific numbers: the focal group breakdown, trend, distribution, and cited correlation. */
function buildFocalFacts(question: string, table: Table, profiles: ColumnProfile[]) {
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  const dims = profiles.filter((p) => p.role === "dimension");
  const time = profiles.find((p) => p.role === "time");
  const mMetrics = resolveCols(question, metrics);
  const mDims = resolveCols(question, dims);
  const metric = mMetrics[0] ?? metrics[0];
  const dim = mDims[0];

  const facts: Record<string, unknown> = {};

  if (metric && dim) {
    const ranked = groupBy(table, dim.name, metric.name, "sum");
    const grandTotal = ranked.reduce((s, [, v]) => s + v, 0);
    const top3 = ranked.slice(0, 3).reduce((s, [, v]) => s + v, 0);
    facts.breakdown = {
      dimension: dim.name,
      metric: metric.name,
      aggregate: "sum",
      groupCount: ranked.length,
      total: round2(grandTotal),
      topGroupSharePct: grandTotal && ranked[0] ? round2((ranked[0][1] / grandTotal) * 100) : null,
      top3SharePct: grandTotal ? round2((top3 / grandTotal) * 100) : null,
      topGroups: ranked.slice(0, 8).map(([key, value]) => ({
        key,
        value: round2(value),
        sharePct: grandTotal ? round2((value / grandTotal) * 100) : null,
      })),
      bottomGroup: ranked.length ? { key: ranked[ranked.length - 1][0], value: round2(ranked[ranked.length - 1][1]) } : null,
    };
  }

  if (mMetrics.length >= 2) {
    const [a, b] = mMetrics;
    const r = pearson(numericColumn(table, a.name), numericColumn(table, b.name));
    if (Number.isFinite(r)) {
      facts.correlation = { a: a.name, b: b.name, r: round2(r), r2: round2(r * r), strength: strengthLabel(r), direction: r > 0 ? "positive" : "negative" };
    }
  }

  if (time && metric) {
    const order = sortByTime(table, time.name);
    const series = order.map((i) => numericColumn(table, metric.name)[i]).filter(Number.isFinite);
    if (series.length >= 2) {
      const first = series[0];
      const last = series[series.length - 1];
      const pct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
      facts.trend = { metric: metric.name, over: time.name, first: round2(first), last: round2(last), changePct: round2(pct), peak: round2(Math.max(...series)), trough: round2(Math.min(...series)), periods: series.length };
    }
  }

  if (mDims[0]) {
    const counts = aggregateCount(table, mDims[0].name);
    const totalC = counts.reduce((s, [, c]) => s + c, 0);
    if (totalC > 0) {
      facts.distribution = {
        column: mDims[0].name,
        distinct: counts.length,
        top: counts.slice(0, 8).map(([value, count]) => ({ value, count, pct: round2((count / totalC) * 100) })),
      };
    }
  }

  return facts;
}

/**
 * Assemble the full aggregates-only evidence payload: dataset metadata (+ the user's goal), the
 * deterministic one-liner, question-specific facts, and a whole-dataset statistical overview. No raw
 * rows ever leave — this mirrors the /api/insights privacy boundary.
 */
function buildEvidence(question: string, table: Table, profiles: ColumnProfile[], grounded: string, domain?: string) {
  return {
    question,
    intent: grounded ? "specific" : "open-ended",
    dataset: {
      name: table.name,
      rowCount: table.rowCount,
      sampledFrom: table.sampledFrom ?? null,
      domain: domain || undefined,
      userContext: readUserContext(),
      columns: profiles.map((p) => ({ name: p.name, role: p.role, type: p.type, fillRatePct: round2(p.fillRate * 100) })),
    },
    grounded: grounded || undefined,
    facts: buildFocalFacts(question, table, profiles),
    overview: buildOverview(table, profiles),
  };
}

/**
 * Answer a question with the optional LLM as a principal analyst, grounded in the exact numbers the
 * engine computed (plus a whole-dataset brief so open-ended questions work too). Falls back to the
 * heuristic answer when the LLM is off or fails.
 */
export async function answerQuestionAI(
  question: string,
  table: Table,
  profiles: ColumnProfile[],
  domain?: string
): Promise<RichAnswer> {
  const base = answerQuestion(question, table, profiles);
  if (!llmOn()) return { ...base, source: "heuristic" };
  try {
    const evidence = buildEvidence(question, table, profiles, base.ok ? base.answer : "", domain);
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: "answer", ...evidence }),
    });
    if (res.ok) {
      const data = (await res.json()) as { answer?: string; followups?: string[] };
      if (data.answer && data.answer.trim()) {
        return {
          ok: true,
          answer: data.answer.trim(),
          chart: base.chart, // present for specific questions; undefined for open-ended
          source: "llm",
          followups: Array.isArray(data.followups)
            ? data.followups.filter((s) => typeof s === "string" && s.trim()).slice(0, 3)
            : undefined,
        };
      }
    }
  } catch {
    // fall through to the heuristic answer
  }
  return { ...base, source: "heuristic" };
}
