import type {
  CleaningPreview,
  CleaningReport,
  ColumnCleaning,
  SemanticType,
  Table,
} from "./types";
import { inferType, parseNumeric } from "./profile";

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

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Normalize a date string to YYYY-MM-DD (or "YYYY-MM-DD HH:MM"), avoiding timezone shifts for common formats. */
function canonicalDate(raw: unknown): { value: string; changed: boolean } | null {
  const orig = String(raw).trim();
  let m = orig.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const base = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    const value = m[4] ? `${base} ${pad(+m[4])}:${m[5]}` : base;
    return { value, changed: value !== orig };
  }
  // US-style M/D/Y or M.D.Y
  m = orig.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/);
  if (m) {
    let year = +m[3];
    if (year < 100) year += 2000;
    const value = `${year}-${pad(+m[1])}-${pad(+m[2])}`;
    return { value, changed: value !== orig };
  }
  // Fallback: let Date try (month names etc.), format with UTC parts to stay stable.
  const d = new Date(orig);
  if (Number.isNaN(d.getTime())) return null;
  const value = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { value, changed: value !== orig };
}

const TRUE_WORDS = new Set(["true", "yes", "y", "1"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0"]);

/** Normalize a single cell given its column type. Returns the cleaned value + whether it changed. */
function normalizeCell(raw: unknown, type: SemanticType): { value: unknown; changed: boolean; trimmed: boolean } {
  if (isEmpty(raw)) return { value: null, changed: false, trimmed: false };

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
    const d = canonicalDate(raw);
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
    if (columns.every((c) => isEmpty(rawRow[c]))) {
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
      const { value, changed, trimmed } = normalizeCell(rawRow[c], typeHints[c]);
      cleaned[c] = value;
      if (isEmpty(rawRow[c])) colStats[c].missing++;
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
}): CleaningReport["steps"] {
  const steps: CleaningReport["steps"] = [];
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
