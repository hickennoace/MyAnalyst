import type { ColumnProfile, NumericSummary, SemanticType, Table } from "./types";
import { maxOf, mean, median, minOf, std, sum } from "./stats";

// Type inference + column profiling. This is where messy real-world cells become typed, usable columns.

// Currency glyphs we recognize — covers ~all world currencies (see lib/currency.ts). The symbol may sit
// BEFORE the number ("₪12,500", "$1,200") or AFTER it ("12,500 ₪", "100 €", "¥1200"), with an optional space.
const CUR = "$€£¥₪₹₩₽₺฿₱₫₦₴₵₲₸₾₡";
const CURRENCY_RE = new RegExp(
  `^\\s*\\(?\\s*(?:[${CUR}]\\s?[\\d,]+(?:\\.\\d+)?|[\\d,]+(?:\\.\\d+)?\\s?[${CUR}])\\s*\\)?\\s*$`
);
const PERCENT_RE = /^\s*-?[\d,]+(\.\d+)?\s*%\s*$/;
const NUMERIC_RE = /^\s*-?[\d,]+(\.\d+)?\s*$/;

/** Parse a single cell into a number, tolerating any currency symbol (before OR after the digits),
 *  thousands separators, %, currency codes, and (parentheses) negatives. */
export function parseNumeric(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return NaN;
  if (typeof raw === "number") return raw;
  const str = String(raw).trim();
  const negative = /^\(.*\)$/.test(str); // accounting negatives: (1,200)
  // Pull out the numeric core (digits + optional decimal) after dropping thousands commas — robust to a
  // currency symbol/code on either side, stray spaces, "%", etc.
  const m = str.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return NaN;
  let n = Number(m[0]);
  if (!Number.isFinite(n)) return NaN;
  if (negative && n > 0) n = -n;
  return n;
}

function looksLikeDate(raw: unknown): boolean {
  if (raw instanceof Date) return true;
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (s.length < 6) return false;
  // ISO, slash, or month-name formats — but reject pure integers (years handled separately by header hints).
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) return true;
  if (/^\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}/.test(s)) return true;
  if (/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{2,4}/.test(s)) return true;
  if (/^[A-Za-z]{3,}\s+\d{1,2},?\s+\d{2,4}/.test(s)) return true;
  return false;
}

function toIso(raw: unknown): string | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.toISOString();
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Decide the semantic type of a column from a sample of its values + its header name. */
export function inferType(name: string, values: unknown[]): SemanticType {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (nonNull.length === 0) return "text";
  const lname = name.toLowerCase();

  const sample = nonNull.slice(0, 200).map((v) => String(v).trim());
  const frac = (pred: (s: string) => boolean) =>
    sample.filter(pred).length / sample.length;

  const boolWords = new Set(["true", "false", "yes", "no", "y", "n", "0", "1"]);
  if (frac((s) => boolWords.has(s.toLowerCase())) > 0.95 && new Set(sample.map((s) => s.toLowerCase())).size <= 3)
    return "boolean";

  if (frac((s) => PERCENT_RE.test(s)) > 0.7) return "percent";
  if (frac((s) => CURRENCY_RE.test(s)) > 0.7) return "currency";
  if (/(price|revenue|cost|amount|sales|profit|income|usd|eur|spend|balance|value|salary|salaries|wage|wages|\bpay\b|paid|payment|payroll|fee|fees|rent|budget|expense|expenses|charge|turnover|invoice|earnings|compensation)/.test(lname) &&
      frac((s) => NUMERIC_RE.test(s)) > 0.7)
    return "currency";

  if (frac((s) => looksLikeDate(s)) > 0.7) return "date";
  if (/(date|time|day|month|year|period|timestamp)/.test(lname) && frac((s) => looksLikeDate(s)) > 0.4)
    return "date";

  if (frac((s) => NUMERIC_RE.test(s)) > 0.8) {
    const allInt = sample.every((s) => /^\s*-?[\d,]+\s*$/.test(s));
    const distinct = new Set(sample).size;
    // High-cardinality integer that looks like a key → id (covers "id", "_id", "...Id", codes, numbers).
    if (allInt && /(\bid\b|_id|id$|code|number|no\.|key|uuid|guid)/.test(lname) && distinct / sample.length > 0.8)
      return "id";
    return allInt ? "integer" : "number";
  }

  const distinct = new Set(sample.map((s) => s.toLowerCase())).size;
  if (distinct / sample.length < 0.5 && distinct <= 50) return "category";
  if (/(\bid\b|_id|id$|uuid|guid|email|url|key)/.test(lname)) return "id";
  return "text";
}

function numericSummary(values: number[]): NumericSummary {
  const xs = values.filter((x) => Number.isFinite(x));
  return {
    min: minOf(xs),
    max: maxOf(xs),
    mean: mean(xs),
    median: median(xs),
    std: std(xs),
    sum: sum(xs),
    count: xs.length,
  };
}

const NUMERIC_TYPES: SemanticType[] = ["number", "currency", "percent", "integer"];

/** Build a full profile for every column in the table.
 *  `typeHints` lets a prior stage (e.g. cleaning) pin a column's type so re-sniffing
 *  normalized values can't lose information (a stripped "$1,200" → 1200 staying "currency"). */
export function profileTable(table: Table, typeHints?: Record<string, SemanticType>): ColumnProfile[] {
  return table.columns.map((col) => {
    const raw = table.rows.map((r) => r[col]);
    const type = typeHints?.[col] ?? inferType(col, raw);
    const nonNull = raw.filter((v) => v !== null && v !== undefined && v !== "");
    const fillRate = table.rowCount ? nonNull.length / table.rowCount : 0;
    const distinctSet = new Set(nonNull.map((v) => String(v)));
    const distinctCount = distinctSet.size;
    const cardinalityRatio = nonNull.length ? distinctCount / nonNull.length : 0;

    let numeric: NumericSummary | undefined;
    let dateRange: { min: string; max: string } | undefined;
    if (NUMERIC_TYPES.includes(type)) {
      numeric = numericSummary(raw.map(parseNumeric));
    } else if (type === "date") {
      const isos = raw.map(toIso).filter((s): s is string => s !== null).sort();
      if (isos.length) dateRange = { min: isos[0], max: isos[isos.length - 1] };
    }

    const role = pickRole(type, cardinalityRatio);
    const samples = [...distinctSet].slice(0, 5);

    // Frequency breakdown for categorical-ish columns (dimensions, booleans, low-card text).
    let topValues: ColumnProfile["topValues"];
    if ((role === "dimension" || type === "boolean") && nonNull.length > 0) {
      const counts = new Map<string, number>();
      for (const v of nonNull) {
        const key = String(v);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      topValues = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([value, count]) => ({ value, count, pct: count / nonNull.length }));
    }

    return {
      name: col,
      type,
      fillRate,
      distinctCount,
      cardinalityRatio,
      numeric,
      dateRange,
      samples,
      role,
      topValues,
    };
  });
}

function pickRole(type: SemanticType, cardinalityRatio: number): ColumnProfile["role"] {
  if (type === "date") return "time";
  if (type === "id") return "identifier";
  if (NUMERIC_TYPES.includes(type)) return "metric";
  if (type === "category" || type === "boolean") return "dimension";
  if (type === "text" && cardinalityRatio < 0.5) return "dimension";
  return "other";
}

/** Helper: extract a column's values as numbers. */
export function numericColumn(table: Table, col: string): number[] {
  return table.rows.map((r) => parseNumeric(r[col]));
}

/** Helper: extract a date column as sortable ISO strings (null where unparseable). */
export function dateColumn(table: Table, col: string): (string | null)[] {
  return table.rows.map((r) => toIso(r[col]));
}
