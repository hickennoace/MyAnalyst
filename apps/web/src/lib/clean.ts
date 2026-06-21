import type {
  CleaningPreview,
  CleaningReport,
  ColumnCleaning,
  SemanticType,
  Table,
} from "./types";
import { inferType, isNullToken, parseNumeric } from "./profile";

// Cleaning & normalization - "the moat". Turns a raw, messy Table into a typed, deduped, normalized
// Table and a transparent report of every change. Runs before profiling/KPIs/stats so the rest of the
// pipeline can trust its input. Type detection happens once here and is handed downstream via typeHints.

const TOTAL_LABEL_RE = /^(grand\s+)?(total|totals|sum|subtotal)\b/i;
const NUMERIC_TYPES: SemanticType[] = ["number", "currency", "percent", "integer"];

export interface CleanResult {
  table: Table;
  report: CleaningReport;
  /** detected type per column, so profileTable doesn't have to re-sniff normalized values. */
  typeHints: Record<string, SemanticType>;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Decide whether a date column uses DAY-first ordering (DD/MM/YYYY, the global majority) vs US month-first.
 * High-precision: only flips to day-first on UNAMBIGUOUS evidence — a first field >12 can only be a day; a
 * second field >12 can only be a day (→ month-first). With no disambiguating value, keeps the US default so
 * existing US files are unaffected (a file whose days all happen to be ≤12 is genuinely indistinguishable).
 */
export function detectDayFirst(values: unknown[]): boolean {
  for (const v of values) {
    if (typeof v !== "string") continue;
    const m = v.trim().match(/^(\d{1,2})[\/.](\d{1,2})[\/.]\d{2,4}/);
    if (!m) continue;
    const f1 = +m[1], f2 = +m[2];
    if (f1 > 12 && f2 <= 12) return true; // first field can only be a day → day-first
    if (f2 > 12 && f1 <= 12) return false; // second field can only be a day → month-first
  }
  return false; // no evidence either way → keep the US month-first default
}

/** Normalize a date string to YYYY-MM-DD (or "YYYY-MM-DD HH:MM"), avoiding timezone shifts for common
 *  formats. `dayFirst` (detected per column) picks the order for ambiguous DD/MM vs MM/DD slash/dot dates. */
function canonicalDate(raw: unknown, dayFirst = false): { value: string; changed: boolean } | null {
  const orig = String(raw).trim();
  let m = orig.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const base = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    const value = m[4] ? `${base} ${pad(+m[4])}:${m[5]}` : base;
    return { value, changed: value !== orig };
  }
  // Slash/dot dates: D/M/Y or M/D/Y depending on the column's detected order.
  m = orig.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/);
  if (m) {
    const f1 = +m[1], f2 = +m[2];
    let month = dayFirst ? f2 : f1;
    let day = dayFirst ? f1 : f2;
    // A field >12 can only be a day — honor that even if it contradicts the assumed order (and it stops the
    // old bug where "13/06/2026" produced an invalid "2026-13-06" string that later NaN'd the cell).
    if (month > 12 && day <= 12) [month, day] = [day, month];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let year = +m[3];
      if (year < 100) year += 2000;
      const value = `${year}-${pad(month)}-${pad(day)}`;
      return { value, changed: value !== orig };
    }
    // out of range (e.g. 13/13) — fall through to Date() rather than emit a bad ISO string.
  }
  // Fallback: let Date try (month names etc.), format with UTC parts to stay stable.
  const d = new Date(orig);
  if (Number.isNaN(d.getTime())) return null;
  const value = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { value, changed: value !== orig };
}

const TRUE_WORDS = new Set(["true", "yes", "y", "1"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0"]);

/** Whether a column's type means a textual marker like "-"/"none" can't be a real value (so it's missing). */
function isNumericish(type: SemanticType): boolean {
  return NUMERIC_TYPES.includes(type) || type === "date" || type === "boolean";
}

/** Normalize a single cell given its column type. Returns the cleaned value + whether it changed. */
function normalizeCell(raw: unknown, type: SemanticType, dayFirst = false): { value: unknown; changed: boolean; trimmed: boolean } {
  // Textual null markers ("N/A", "NULL", and — in numeric/date columns — "-"/"none"/"?") become real nulls
  // so they don't poison numeric parsing, fill rates, or category/group tallies downstream.
  if (isNullToken(raw, isNumericish(type))) return { value: null, changed: false, trimmed: false };

  const str = String(raw);
  const trimmedStr = str.trim();
  const trimmed = trimmedStr !== str;

  if (NUMERIC_TYPES.includes(type)) {
    const n = parseNumeric(raw);
    if (!Number.isFinite(n)) return { value: trimmedStr, changed: trimmed, trimmed };
    const value = type === "integer" ? Math.round(n) : n;
    return { value, changed: String(value) !== trimmedStr, trimmed };
  }

  if (type === "date") {
    const d = canonicalDate(raw, dayFirst);
    if (!d) return { value: trimmedStr, changed: trimmed, trimmed };
    return { value: d.value, changed: d.changed, trimmed };
  }

  if (type === "boolean") {
    const low = trimmedStr.toLowerCase();
    if (TRUE_WORDS.has(low)) return { value: true, changed: trimmedStr !== "true", trimmed };
    if (FALSE_WORDS.has(low)) return { value: false, changed: trimmedStr !== "false", trimmed };
  }

  // category / id / text: collapse internal whitespace runs and trim.
  const collapsed = trimmedStr.replace(/\s+/g, " ");
  return { value: collapsed, changed: collapsed !== str, trimmed };
}

function displayCell(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

export function cleanTable(raw: Table, typeOverrides?: Record<string, SemanticType>): CleanResult {
  const columns = raw.columns;

  // 1. Detect each column's type once, from the raw values - unless the user pinned a type
  //    via the column controls, in which case we honor their choice and normalize to it.
  const typeHints: Record<string, SemanticType> = {};
  for (const col of columns) {
    typeHints[col] = typeOverrides?.[col] ?? inferType(col, raw.rows.map((r) => r[col]));
  }

  // Decide DD/MM vs MM/DD order once per date column, from the raw values.
  const dayFirst: Record<string, boolean> = {};
  for (const col of columns) {
    if (typeHints[col] === "date") dayFirst[col] = detectDayFirst(raw.rows.map((r) => r[col]));
  }
  // "Missing" is type-aware: a "-"/"none" is missing in a numeric/date column but a real value in a category.
  const isBlank = (c: string, v: unknown) => isNullToken(v, isNumericish(typeHints[c]));

  const colStats: Record<string, ColumnCleaning> = {};
  for (const col of columns) {
    colStats[col] = { name: col, detectedType: typeHints[col], cellsNormalized: 0, trimmed: 0, missing: 0 };
  }

  const cleanedRows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const preview: CleaningPreview = { columns, rows: [] };
  let duplicatesRemoved = 0;
  let emptyRowsRemoved = 0;
  let totalRowsRemoved = 0;
  let cellsNormalized = 0;
  let cellsTrimmed = 0;

  for (const rawRow of raw.rows) {
    // Drop fully-empty rows.
    if (columns.every((c) => isBlank(c, rawRow[c]))) {
      emptyRowsRemoved++;
      continue;
    }

    // Drop trailing-total / subtotal rows: a label column says "Total" and the row isn't a normal record.
    const looksTotal = columns.some(
      (c) => typeHints[c] !== "date" && !NUMERIC_TYPES.includes(typeHints[c]) && TOTAL_LABEL_RE.test(String(rawRow[c] ?? ""))
    );
    if (looksTotal) {
      totalRowsRemoved++;
      continue;
    }

    // Normalize each cell.
    const cleaned: Record<string, unknown> = {};
    const beforeCells: string[] = [];
    const afterCells: string[] = [];
    const changedCells: boolean[] = [];
    for (const c of columns) {
      const { value, changed, trimmed } = normalizeCell(rawRow[c], typeHints[c], dayFirst[c]);
      cleaned[c] = value;
      if (isBlank(c, rawRow[c])) colStats[c].missing++;
      if (changed) {
        colStats[c].cellsNormalized++;
        cellsNormalized++;
      }
      if (trimmed) {
        colStats[c].trimmed++;
        cellsTrimmed++;
      }
      beforeCells.push(displayCell(rawRow[c]));
      afterCells.push(displayCell(value));
      changedCells.push(displayCell(rawRow[c]) !== displayCell(value));
    }

    // Drop exact duplicate rows (by normalized content).
    const key = JSON.stringify(columns.map((c) => cleaned[c]));
    if (seen.has(key)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(key);

    if (preview.rows.length < 8) {
      preview.rows.push({ before: beforeCells, after: afterCells, changed: changedCells });
    }
    cleanedRows.push(cleaned);
  }

  const steps = buildSteps({
    emptyRowsRemoved,
    totalRowsRemoved,
    duplicatesRemoved,
    cellsNormalized,
    cellsTrimmed,
    dayFirstCols: Object.values(dayFirst).filter(Boolean).length,
  });

  const report: CleaningReport = {
    rowsBefore: raw.rowCount,
    rowsAfter: cleanedRows.length,
    duplicatesRemoved,
    emptyRowsRemoved,
    totalRowsRemoved,
    cellsNormalized,
    cellsTrimmed,
    columns: columns.map((c) => colStats[c]),
    steps,
    preview,
  };

  return {
    table: { name: raw.name, columns, rows: cleanedRows, rowCount: cleanedRows.length },
    report,
    typeHints,
  };
}

function buildSteps(s: {
  emptyRowsRemoved: number;
  totalRowsRemoved: number;
  duplicatesRemoved: number;
  cellsNormalized: number;
  cellsTrimmed: number;
  dayFirstCols: number;
}): CleaningReport["steps"] {
  const steps: CleaningReport["steps"] = [];
  if (s.dayFirstCols)
    steps.push({ label: "Read dates as day-first", detail: "Detected DD/MM/YYYY ordering (a day value over 12 gave it away) and parsed dates accordingly, not month-first.", count: s.dayFirstCols });
  if (s.emptyRowsRemoved)
    steps.push({ label: "Removed empty rows", detail: "Rows with no values in any column.", count: s.emptyRowsRemoved });
  if (s.totalRowsRemoved)
    steps.push({ label: "Removed total rows", detail: "Trailing 'Total'/'Subtotal' summary rows that would skew the stats.", count: s.totalRowsRemoved });
  if (s.duplicatesRemoved)
    steps.push({ label: "Removed duplicate rows", detail: "Exact duplicates after normalization.", count: s.duplicatesRemoved });
  if (s.cellsNormalized)
    steps.push({ label: "Normalized values", detail: "Stripped currency symbols, thousands separators, and unified number/date formats.", count: s.cellsNormalized });
  if (s.cellsTrimmed)
    steps.push({ label: "Trimmed whitespace", detail: "Removed stray leading/trailing/internal whitespace.", count: s.cellsTrimmed });
  if (steps.length === 0)
    steps.push({ label: "No changes needed", detail: "Your data was already clean and consistently typed.", count: 0 });
  return steps;
}
