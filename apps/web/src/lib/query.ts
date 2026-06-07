import type { ChartSpec, ChartType, ColumnProfile, Table } from "./types";
import { numericColumn } from "./profile";
import { maxOf, minOf, pearson, isRedundantCorrelation } from "./stats";
import { aggregateCount, buildChart, buildComparisonChart, type ChartRequest } from "./charts";
import { parseChartRequest } from "./nl-chart";
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
  /** Plain-language account of HOW the number was computed — the rows, the aggregation, the filter.
   *  Surfaced as a collapsible "How I computed this" so users can trust (and audit) every figure. */
  method?: string;
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
    case "max": return maxOf(xs);
    case "min": return minOf(xs);
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

/** "N of M rows (scope)" or "M rows" — the row basis quoted in every `method` string. */
function rowsNote(view: Table, table: Table, filter?: DataFilter): string {
  return filter ? `${view.rowCount.toLocaleString()} of ${table.rowCount.toLocaleString()} rows ${filter.phrase}` : `${table.rowCount.toLocaleString()} rows`;
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

  // Comparison questions ("North vs South revenue", "how does 2023 compare to 2022") — two slices of
  // the same dimension or two periods, answered with the gap, ratio and % difference plus a paired bar.
  // Detected before the single filter so a "vs" question isn't collapsed to one slice.
  const comparison = detectComparison(text, table, profiles);
  if (comparison) return answerComparison(comparison, table, profiles);

  // Filtered & conditional questions: "total revenue in 2023", "average order value for the North
  // region", "how many orders where revenue is over 100". We answer over a filtered VIEW of the rows
  // and weave the scope into the prose. `view` is the (possibly) filtered table; `scope` is the natural
  // clause appended to answers. Charts are built from `view`, so they reflect the filter too.
  const filter = detectFilter(text, table, profiles);
  const view = filter ? applyFilter(table, filter) : table;
  if (filter && view.rowCount === 0) {
    return { ok: false, answer: `No records match ${filter.label}. Try a different value or range.` };
  }
  const scope = filter ? ` ${filter.phrase}` : "";

  // 1. Row count.
  if (/\b(how many|number of|count of|count)\b/.test(lower) && (/\b(row|record|entr|data point|observation)/.test(lower) || filter)) {
    return {
      ok: true,
      answer: `There are ${view.rowCount.toLocaleString()} records${filter ? scope : " in the dataset"}.`,
      method: `Counted rows — ${rowsNote(view, table, filter)}.`,
    };
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
      const counts = aggregateCount(view, col.name);
      const total = counts.reduce((s, [, c]) => s + c, 0);
      if (total > 0) {
        const top = counts[0];
        const second = counts[1];
        const tail = second ? `, then "${second[0]}" (${Math.round((second[1] / total) * 100)}%)` : "";
        return {
          ok: true,
          answer: `The most common ${col.name} is "${top[0]}" — ${top[1]} of ${total} (${Math.round((top[1] / total) * 100)}%)${tail}${scope}.`,
          chart: buildChart(view, profiles, { type: "bar", x: col.name, y: [], count: true }),
          method: `Tallied how often each ${col.name} occurs across ${rowsNote(view, table, filter)} — ${counts.length} distinct values.`,
        };
      }
    }
  }

  // 2. Correlation / relationship.
  if (/correlat|relationship|related|associat|vs\.?|versus/.test(lower)) {
    const ms = mMetrics.length >= 2 ? mMetrics : metrics;
    if (ms.length >= 2) {
      const [a, b] = ms;
      const r = pearson(numericColumn(view, a.name), numericColumn(view, b.name));
      if (Number.isFinite(r)) {
        const strength = Math.abs(r) > 0.7 ? "strong" : Math.abs(r) > 0.4 ? "moderate" : "weak";
        const dir = r > 0 ? "positive" : "negative";
        return {
          ok: true,
          answer: `${a.name} and ${b.name} have a ${strength} ${dir} correlation (r = ${r.toFixed(2)})${scope}. ${
            Math.abs(r) > 0.4 ? "They tend to move together." : "The link is loose."
          }`,
          chart: buildChart(view, profiles, { type: "scatter", x: a.name, y: [b.name] }),
          method: `Pearson correlation of ${a.name} and ${b.name} across ${rowsNote(view, table, filter)}.`,
        };
      }
    }
  }

  // 3. Trend over time.
  if (time && /(trend|over time|timeline|change over|grow|growth|increase|decrease|trajectory)/.test(lower)) {
    const m = mMetrics[0] ?? metrics[0];
    if (m) {
      const order = sortByTime(view, time.name);
      const mCol = numericColumn(view, m.name);
      const series = order.map((i) => mCol[i]).filter(Number.isFinite);
      if (series.length >= 2) {
        const first = series[0];
        const last = series[series.length - 1];
        const pct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
        const dir = pct > 1 ? "increased" : pct < -1 ? "decreased" : "stayed roughly flat";
        return {
          ok: true,
          answer: `${m.name} ${dir} ${Math.abs(pct).toFixed(1)}% over the period${scope} (${fmt(first, m)} → ${fmt(last, m)}).`,
          chart: buildChart(view, profiles, { type: "line", x: time.name, y: [m.name] }),
          method: `Compared first vs last ${m.name} along ${time.name} across ${rowsNote(view, table, filter)} (${series.length} points).`,
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
      const ranked = groupBy(view, dim.name, metric.name, agg);
      if (ranked.length) {
        const wantLowest = /\b(lowest|bottom|worst|smallest|least)\b/.test(lower);
        const ordered = wantLowest ? [...ranked].reverse() : ranked;
        const top = ordered[0];
        const aggLabel = agg === "mean" ? "average" : "total";
        return {
          ok: true,
          answer: `By ${aggLabel} ${metric.name}, ${dim.name} "${top[0]}" is ${wantLowest ? "lowest" : "highest"} at ${fmt(top[1], metric)}${scope}.`,
          chart: agg === "sum" ? buildChart(view, profiles, { type: "bar", x: dim.name, y: [metric.name], aggregate: true }) : undefined,
          method: `${agg === "mean" ? "Averaged" : "Summed"} ${metric.name} by ${dim.name} across ${rowsNote(view, table, filter)}, then ranked ${wantLowest ? "ascending" : "descending"} (${ranked.length} groups).`,
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
        const ranked = groupBy(view, dim.name, metric.name, aggMatch.agg);
        const top = ranked[0];
        return {
          ok: true,
          answer: `${cap(aggMatch.label)} ${metric.name} by ${dim.name}${scope}: ${dim.name} "${top[0]}" leads at ${fmt(top[1], metric)} (${ranked.length} groups).`,
          chart: aggMatch.agg === "sum" ? buildChart(view, profiles, { type: "bar", x: dim.name, y: [metric.name], aggregate: true }) : undefined,
          method: `Took the ${aggMatch.label} of ${metric.name} within each ${dim.name} across ${rowsNote(view, table, filter)} (${ranked.length} groups).`,
        };
      }
      const v = aggregate(numericColumn(view, metric.name), aggMatch.agg);
      return {
        ok: true,
        answer: `The ${aggMatch.label} of ${metric.name}${scope} is ${fmt(v, metric)}.`,
        method: `${cap(aggMatch.label)} of ${metric.name} across ${rowsNote(view, table, filter)}.`,
      };
    }
  }

  // 6. A bare metric mention → give its headline stats.
  if (mMetrics.length) {
    const m = mMetrics[0];
    const vals = numericColumn(view, m.name);
    return {
      ok: true,
      answer: `${m.name}${scope}: total ${fmt(aggregate(vals, "sum"), m)}, average ${fmt(aggregate(vals, "mean"), m)}, range ${fmt(aggregate(vals, "min"), m)}–${fmt(aggregate(vals, "max"), m)}.`,
      method: `Summary stats (total, average, min/max) of ${m.name} across ${rowsNote(view, table, filter)}.`,
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

// ── Filters ──────────────────────────────────────────────────────────────────
// Turn a plain-English condition in the question into a row predicate so the engine can answer
// "total revenue in 2023", "average order value for the North region", or "how many orders where
// revenue is over 100". Three kinds, tried in order: time/year, numeric comparison on a named metric,
// and a categorical value of a dimension. Everything downstream runs on the filtered VIEW, so numbers
// and charts stay consistent with the stated scope.

export interface DataFilter {
  column: string;
  /** Natural clause woven into answers, e.g. `in 2023`, `for Region "North"`, `where Revenue is over 100`. */
  phrase: string;
  /** Short label for compact UI / error messages, e.g. `2023`, `North`, `Revenue > 100`. */
  label: string;
  predicate: (row: Record<string, unknown>) => boolean;
}

/** Return a filtered copy of the table (same columns, subset of rows). */
export function applyFilter(table: Table, filter: DataFilter): Table {
  const rows = table.rows.filter(filter.predicate);
  return { ...table, rows, rowCount: rows.length };
}

// Words that can coincide with a category value but are really question grammar — never treat as a filter value.
const FILTER_STOP = new Set([
  "total", "sum", "average", "avg", "mean", "median", "count", "number", "max", "min", "maximum", "minimum",
  "highest", "lowest", "top", "bottom", "most", "least", "data", "value", "values", "record", "records", "row",
  "rows", "the", "and", "or", "of", "in", "for", "by", "per", "is", "are", "with", "where", "over", "under",
  "between", "than", "all", "each", "show",
]);

function coerceNum(v: unknown): number {
  if (typeof v === "number") return v;
  return parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
}

/** Distinct non-empty values of a column (capped, for matching against the question). */
function distinctValues(table: Table, col: string, cap = 500): string[] {
  const seen = new Set<string>();
  for (const r of table.rows) {
    const v = r[col];
    if (v === null || v === undefined || v === "") continue;
    seen.add(String(v));
    if (seen.size >= cap) break;
  }
  return [...seen];
}

/** Whole-word/phrase containment (so "north" doesn't match inside "northern" and survives punctuation). */
function containsPhrase(hayLower: string, needleLower: string): boolean {
  if (needleLower.length < 2) return false;
  const esc = needleLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(hayLower);
}

const NUMRE = "(-?\\d[\\d,]*(?:\\.\\d+)?)";
const parseNum = (s: string): number => parseFloat(s.replace(/,/g, ""));

export function detectFilter(question: string, table: Table, profiles: ColumnProfile[]): DataFilter | undefined {
  const lower = question.toLowerCase();

  // 1) Time / year on the time column: "in 2023", "after 2022", "between 2021 and 2023".
  const time = profiles.find((p) => p.role === "time");
  if (time) {
    const yearOf = (row: Record<string, unknown>): number | null => {
      const d = new Date(String(row[time.name]));
      return Number.isNaN(d.getTime()) ? null : d.getFullYear();
    };
    const between = lower.match(/between\s+((?:19|20)\d{2})\s+(?:and|to|-)\s+((?:19|20)\d{2})/);
    if (between) {
      const lo = Math.min(Number(between[1]), Number(between[2]));
      const hi = Math.max(Number(between[1]), Number(between[2]));
      return { column: time.name, phrase: `from ${lo} to ${hi}`, label: `${lo}–${hi}`, predicate: (r) => { const y = yearOf(r); return y !== null && y >= lo && y <= hi; } };
    }
    const years = [...lower.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => Number(m[1]));
    if (years.length) {
      const y = years[0];
      if (/\b(after|since|from)\b/.test(lower)) return { column: time.name, phrase: `after ${y}`, label: `after ${y}`, predicate: (r) => { const yr = yearOf(r); return yr !== null && yr > y; } };
      if (/\b(before|until|up to|up until)\b/.test(lower)) return { column: time.name, phrase: `before ${y}`, label: `before ${y}`, predicate: (r) => { const yr = yearOf(r); return yr !== null && yr < y; } };
      return { column: time.name, phrase: `in ${y}`, label: `${y}`, predicate: (r) => yearOf(r) === y };
    }
  }

  // 2) Numeric comparison on a NAMED metric: "revenue over 100", "units between 10 and 20".
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  const namedMetric = resolveCols(question, metrics)[0];
  if (namedMetric) {
    const m = namedMetric.name;
    const btw = lower.match(new RegExp(`${NUMRE}\\s+(?:and|to)\\s+${NUMRE}`));
    if (/\bbetween\b/.test(lower) && btw) {
      const lo = Math.min(parseNum(btw[1]), parseNum(btw[2]));
      const hi = Math.max(parseNum(btw[1]), parseNum(btw[2]));
      return { column: m, phrase: `where ${m} is between ${lo} and ${hi}`, label: `${m} ${lo}–${hi}`, predicate: (r) => { const v = coerceNum(r[m]); return Number.isFinite(v) && v >= lo && v <= hi; } };
    }
    const cmp = lower.match(new RegExp(`(>=|<=|>|<|over|above|greater than|more than|at least|under|below|less than|fewer than|at most)\\s*${NUMRE}`));
    if (cmp) {
      const op = cmp[1];
      const n = parseNum(cmp[2]);
      const gte = /^(>=|at least)$/.test(op);
      const lte = /^(<=|at most)$/.test(op);
      const gt = /^(>|over|above|greater than|more than)$/.test(op);
      const pred = gte ? (v: number) => v >= n : lte ? (v: number) => v <= n : gt ? (v: number) => v > n : (v: number) => v < n;
      const sym = gte ? "≥" : lte ? "≤" : gt ? ">" : "<";
      const word = gte ? "at least" : lte ? "at most" : gt ? "over" : "under";
      return { column: m, phrase: `where ${m} is ${word} ${n}`, label: `${m} ${sym} ${n}`, predicate: (r) => { const v = coerceNum(r[m]); return Number.isFinite(v) && pred(v); } };
    }
  }

  // 3) Categorical value of a dimension named in the question: "for the North region", "status cancelled".
  const dims = profiles.filter((p) => p.role === "dimension");
  let best: { col: string; value: string } | undefined;
  for (const d of dims) {
    for (const v of distinctValues(table, d.name)) {
      const vl = v.toLowerCase();
      if (vl.length < 2 || FILTER_STOP.has(vl)) continue;
      if (/^-?\d+(\.\d+)?$/.test(vl)) continue; // pure numbers are handled by the numeric filter
      if (vl === d.name.toLowerCase()) continue;
      if (containsPhrase(lower, vl) && (!best || vl.length > best.value.length)) best = { col: d.name, value: v };
    }
  }
  if (best) {
    const target = best.value.toLowerCase();
    const col = best.col;
    return { column: col, phrase: `for ${col} "${best.value}"`, label: best.value, predicate: (r) => String(r[col] ?? "").toLowerCase() === target };
  }

  return undefined;
}

// ── Comparisons ──────────────────────────────────────────────────────────────
// "X vs Y": compare a metric across two slices of one dimension (or two periods). Produces the gap,
// the % difference, the multiple (×), the winner, and a paired bar chart. Runs before the single
// filter so a "vs" question isn't collapsed to one side.

interface Slice {
  label: string;
  predicate: (row: Record<string, unknown>) => boolean;
}

export interface Comparison {
  metric: ColumnProfile;
  agg: "sum" | "mean"; // the other aggregators are nonsensical for a two-slice comparison
  column: string;
  kind: "category" | "time";
  left: Slice;
  right: Slice;
}

const COMPARE_SIGNAL = /\b(vs\.?|versus|compare[ds]?|comparison|compared to|compared with|against|difference between)\b/;

/** Aggregate a metric over the rows matching a predicate. */
function sliceAgg(table: Table, metricName: string, pred: (row: Record<string, unknown>) => boolean, agg: Agg): number {
  const vals = numericColumn(table, metricName);
  const xs: number[] = [];
  table.rows.forEach((row, i) => {
    if (Number.isFinite(vals[i]) && pred(row)) xs.push(vals[i]);
  });
  return aggregate(xs, agg);
}

export function detectComparison(question: string, table: Table, profiles: ColumnProfile[]): Comparison | undefined {
  const lower = question.toLowerCase();
  if (!COMPARE_SIGNAL.test(lower)) return undefined;

  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  if (!metrics.length) return undefined;
  const metric = resolveCols(question, metrics)[0] ?? metrics[0];
  const agg: "sum" | "mean" = /\b(average|avg|mean|per|typical)\b/.test(lower) ? "mean" : "sum";

  // Two distinct years on the time column → period comparison.
  const time = profiles.find((p) => p.role === "time");
  if (time) {
    const years = [...new Set([...lower.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => Number(m[1])))];
    if (years.length >= 2) {
      const yearOf = (row: Record<string, unknown>): number | null => {
        const d = new Date(String(row[time.name]));
        return Number.isNaN(d.getTime()) ? null : d.getFullYear();
      };
      // Keep the order they appear in the question.
      const ordered = years.sort((a, b) => lower.indexOf(String(a)) - lower.indexOf(String(b))).slice(0, 2);
      const [y1, y2] = ordered;
      return {
        metric, agg, column: time.name, kind: "time",
        left: { label: `${y1}`, predicate: (r) => yearOf(r) === y1 },
        right: { label: `${y2}`, predicate: (r) => yearOf(r) === y2 },
      };
    }
  }

  // A dimension with ≥2 of its values named in the question → category comparison.
  let bestDim: { col: string; values: { value: string; pos: number }[] } | undefined;
  for (const d of profiles.filter((p) => p.role === "dimension")) {
    const seen = new Map<string, { value: string; pos: number }>();
    for (const v of distinctValues(table, d.name)) {
      const vl = v.toLowerCase();
      if (vl.length < 2 || FILTER_STOP.has(vl) || /^-?\d+(\.\d+)?$/.test(vl) || vl === d.name.toLowerCase()) continue;
      if (containsPhrase(lower, vl) && !seen.has(vl)) seen.set(vl, { value: v, pos: lower.indexOf(vl) });
    }
    const values = [...seen.values()];
    if (values.length >= 2 && (!bestDim || values.length > bestDim.values.length)) bestDim = { col: d.name, values };
  }
  if (bestDim) {
    const [a, b] = bestDim.values.sort((x, y) => x.pos - y.pos);
    const col = bestDim.col;
    const eq = (val: string) => (r: Record<string, unknown>) => String(r[col] ?? "").toLowerCase() === val.toLowerCase();
    return {
      metric, agg, column: col, kind: "category",
      left: { label: a.value, predicate: eq(a.value) },
      right: { label: b.value, predicate: eq(b.value) },
    };
  }

  return undefined;
}

function answerComparison(c: Comparison, table: Table, profiles: ColumnProfile[]): QueryAnswer {
  const l = sliceAgg(table, c.metric.name, c.left.predicate, c.agg);
  const r = sliceAgg(table, c.metric.name, c.right.predicate, c.agg);
  const aggLabel = c.agg === "mean" ? "average" : "total";
  if (!Number.isFinite(l) || !Number.isFinite(r)) {
    return { ok: false, answer: `I don't have enough data to compare ${aggLabel} ${c.metric.name} for both "${c.left.label}" and "${c.right.label}".` };
  }

  const chart = buildComparisonChart(c.metric.name, c.agg, [[c.left.label, l], [c.right.label, r]]);
  const head = `${cap(aggLabel)} ${c.metric.name}: ${c.left.label} ${fmt(l, c.metric)} vs ${c.right.label} ${fmt(r, c.metric)}.`;
  const method = `Computed the ${aggLabel} ${c.metric.name} for each ${c.kind === "time" ? "period" : c.column} slice — "${c.left.label}" and "${c.right.label}" — then took the difference and ratio.`;

  if (l === r) return { ok: true, answer: `${head} They're equal.`, chart, method };

  const higher = l > r ? c.left.label : c.right.label;
  const lowerLabel = l > r ? c.right.label : c.left.label;
  const gap = Math.abs(l - r);
  const hi = Math.max(l, r);
  const lo = Math.min(l, r);
  const pctAbove = lo > 0 ? (gap / lo) * 100 : NaN;
  const ratio = lo > 0 ? hi / lo : NaN;
  const detail =
    `${higher} is higher by ${fmt(gap, c.metric)}` +
    (Number.isFinite(pctAbove) ? ` (${pctAbove.toFixed(1)}% above ${lowerLabel})` : "") +
    (Number.isFinite(ratio) && ratio >= 1.1 ? `, about ${ratio.toFixed(2)}×` : "") +
    ".";
  return { ok: true, answer: `${head} ${detail}`, chart, method };
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

/** One pass over the rows → per-group total, count and mean of a metric, sorted by total desc. */
function groupStats(table: Table, dim: string, metric: string) {
  const vals = numericColumn(table, metric);
  const m = new Map<string, { sum: number; count: number }>();
  table.rows.forEach((r, i) => {
    const v = vals[i];
    if (!Number.isFinite(v)) return;
    const k = String(r[dim] ?? "—");
    const e = m.get(k) ?? { sum: 0, count: 0 };
    e.sum += v;
    e.count++;
    m.set(k, e);
  });
  return [...m.entries()]
    .map(([key, e]) => ({ key, sum: e.sum, count: e.count, mean: e.count ? e.sum / e.count : NaN }))
    .sort((a, b) => b.sum - a.sum);
}

/** A prior turn in the Ask-your-data conversation (question + the answer the model gave). */
export interface QaTurn {
  q: string;
  a: string;
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
      // Skip tautological pairs (a column derived from another) so the AI doesn't volunteer the obvious.
      if (Number.isFinite(r) && !isRedundantCorrelation(metrics[i].name, metrics[j].name, r)) {
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
    const m0Col = numericColumn(table, metrics[0].name);
    const series = order.map((i) => m0Col[i]).filter(Number.isFinite);
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

  // "X vs Y" comparison facts, so the AI narrates the gap/ratio with the exact slice numbers.
  const comparison = detectComparison(question, table, profiles);
  if (comparison) {
    const l = sliceAgg(table, comparison.metric.name, comparison.left.predicate, comparison.agg);
    const r = sliceAgg(table, comparison.metric.name, comparison.right.predicate, comparison.agg);
    if (Number.isFinite(l) && Number.isFinite(r)) {
      const lo = Math.min(l, r);
      facts.comparison = {
        metric: comparison.metric.name,
        basis: comparison.agg === "mean" ? "average" : "total",
        dimension: comparison.column,
        left: { label: comparison.left.label, value: round2(l) },
        right: { label: comparison.right.label, value: round2(r) },
        difference: round2(Math.abs(l - r)),
        pctDiff: r !== 0 ? round2(((l - r) / Math.abs(r)) * 100) : null,
        ratio: lo > 0 ? round2(Math.max(l, r) / lo) : null,
        higher: l === r ? "equal" : l > r ? comparison.left.label : comparison.right.label,
      };
    }
  }

  if (metric && dim) {
    const stats = groupStats(table, dim.name, metric.name); // sorted by total desc
    const grandTotal = stats.reduce((s, g) => s + g.sum, 0);
    const top3 = stats.slice(0, 3).reduce((s, g) => s + g.sum, 0);
    const byAvg = [...stats].sort((a, b) => b.mean - a.mean);
    facts.breakdown = {
      dimension: dim.name,
      metric: metric.name,
      groupCount: stats.length,
      total: round2(grandTotal),
      topGroupSharePct: grandTotal && stats[0] ? round2((stats[0].sum / grandTotal) * 100) : null,
      top3SharePct: grandTotal ? round2((top3 / grandTotal) * 100) : null,
      // Each group with BOTH its total and its average (+ row count) — so questions about per-unit
      // value ("highest average order", "most efficient channel") are answerable, not just totals.
      topGroups: stats.slice(0, 8).map((g) => ({
        key: g.key,
        total: round2(g.sum),
        average: round2(g.mean),
        count: g.count,
        sharePct: grandTotal ? round2((g.sum / grandTotal) * 100) : null,
      })),
      bottomByTotal: stats.length ? { key: stats[stats.length - 1].key, total: round2(stats[stats.length - 1].sum), average: round2(stats[stats.length - 1].mean) } : null,
      highestAverage: byAvg[0] ? { key: byAvg[0].key, average: round2(byAvg[0].mean), count: byAvg[0].count } : null,
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
    const metricCol = numericColumn(table, metric.name);
    const series = order.map((i) => metricCol[i]).filter(Number.isFinite);
    if (series.length >= 2) {
      const first = series[0];
      const last = series[series.length - 1];
      const pct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
      facts.trend = { metric: metric.name, over: time.name, first: round2(first), last: round2(last), changePct: round2(pct), peak: round2(maxOf(series)), trough: round2(minOf(series)), periods: series.length };
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
function buildEvidence(question: string, table: Table, profiles: ColumnProfile[], grounded: string, domain?: string, history?: QaTurn[]) {
  const conversation = history?.slice(-3).map((h) => ({ q: h.q, a: h.a.slice(0, 320) }));
  // If the question carries a filter, the focal facts are computed on the filtered subset (so the AI
  // narrates the scoped numbers). The overview stays whole-dataset, as broader context.
  const filter = detectFilter(question, table, profiles);
  const view = filter ? applyFilter(table, filter) : table;
  return {
    question,
    intent: grounded ? "specific" : "open-ended",
    conversation: conversation && conversation.length ? conversation : undefined,
    scope: filter ? { clause: filter.phrase, column: filter.column, matchedRows: view.rowCount, ofRows: table.rowCount } : undefined,
    dataset: {
      name: table.name,
      rowCount: table.rowCount,
      sampledFrom: table.sampledFrom ?? null,
      domain: domain || undefined,
      userContext: readUserContext(),
      columns: profiles.map((p) => ({ name: p.name, role: p.role, type: p.type, fillRatePct: round2(p.fillRate * 100) })),
    },
    grounded: grounded || undefined,
    facts: buildFocalFacts(question, view, profiles),
    overview: buildOverview(table, profiles),
  };
}

// ── Chart selection for AI answers ───────────────────────────────────────────
// Specific questions already attach a chart from the deterministic engine. Open-ended (and streamed)
// AI answers didn't get one. Here we give every AI answer a relevant chart: the LLM may emit a
// CONSTRAINED chart request (validated against real columns — it only chooses a type + columns, never
// raw ECharts), and when it doesn't (e.g. the streaming path carries prose only) we derive one locally
// from the question via the same NL→chart parser the chart builder uses. Privacy is untouched.

const CHART_TYPES: ChartType[] = ["line", "bar", "scatter", "area", "pie", "histogram"];

/** Validate an LLM-proposed chart request against the real columns; reject anything off-spec. */
export function sanitizeChartRequest(req: unknown, profiles: ColumnProfile[]): ChartRequest | undefined {
  if (!req || typeof req !== "object") return undefined;
  const r = req as Record<string, unknown>;
  if (!CHART_TYPES.includes(r.type as ChartType)) return undefined;
  const names = new Set(profiles.map((p) => p.name));
  if (typeof r.x !== "string" || !names.has(r.x)) return undefined;
  const y = Array.isArray(r.y) ? (r.y as unknown[]).filter((c): c is string => typeof c === "string" && names.has(c)) : [];
  return { type: r.type as ChartType, x: r.x, y, count: r.count === true, aggregate: r.aggregate === true };
}

/** Build a chart for an AI answer: the validated LLM choice if any, else a locally-parsed one from the
 *  question. Honors any filter in the question so the chart matches the scope. Never throws. */
function buildSuggestedChart(question: string, table: Table, profiles: ColumnProfile[], llmReq?: unknown): ChartSpec | undefined {
  const req = sanitizeChartRequest(llmReq, profiles) ?? parseChartRequest(question, profiles).request;
  if (!req) return undefined;
  const filter = detectFilter(question, table, profiles);
  const view = filter ? applyFilter(table, filter) : table;
  if (filter && view.rowCount === 0) return undefined;
  try {
    return buildChart(view, profiles, req);
  } catch {
    return undefined;
  }
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
  domain?: string,
  history?: QaTurn[],
  onToken?: (delta: string) => void
): Promise<RichAnswer> {
  const base = answerQuestion(question, table, profiles);
  if (!llmOn()) return { ...base, source: "heuristic" };
  const evidence = buildEvidence(question, table, profiles, base.ok ? base.answer : "", domain, history);

  // Preferred path: stream the answer prose token-by-token for a live, responsive feel. Follow-ups
  // are generated locally in streaming mode (the stream carries prose only).
  if (onToken) {
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "answer", stream: true, ...evidence }),
      });
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            text += chunk;
            onToken(chunk);
          }
        }
        if (text.trim()) {
          return {
            ok: true,
            answer: text.trim(),
            // Streaming carries prose only, so derive the chart locally from the question.
            chart: base.chart ?? buildSuggestedChart(question, table, profiles),
            source: "llm",
            method: base.method,
            followups: localFollowups(profiles),
          };
        }
      }
    } catch {
      // streaming failed — fall through to the non-streaming JSON call below
    }
  }

  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: "answer", ...evidence }),
    });
    if (res.ok) {
      const data = (await res.json()) as { answer?: string; followups?: string[]; chart?: unknown };
      if (data.answer && data.answer.trim()) {
        return {
          ok: true,
          answer: data.answer.trim(),
          // Specific questions keep the engine's chart; open-ended ones use the AI's chosen chart
          // (validated), falling back to a locally-parsed one.
          chart: base.chart ?? buildSuggestedChart(question, table, profiles, data.chart),
          source: "llm",
          method: base.method,
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

/** Relevant next questions, derived locally from the column roles (used for streamed answers). */
function localFollowups(profiles: ColumnProfile[]): string[] {
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  const dims = profiles.filter((p) => p.role === "dimension");
  const time = profiles.find((p) => p.role === "time");
  const out: string[] = [];
  if (metrics[0] && dims[0]) out.push(`average ${metrics[0].name} by ${dims[0].name}`);
  if (metrics.length >= 2) out.push(`correlation between ${metrics[0].name} and ${metrics[1].name}`);
  if (time && metrics[0]) out.push(`how did ${metrics[0].name} change over time`);
  if (out.length < 3 && dims[0] && metrics[0]) out.push(`which ${dims[0].name} has the highest ${metrics[0].name}`);
  return out.slice(0, 3);
}
