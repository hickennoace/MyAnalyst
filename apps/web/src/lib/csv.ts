import type { Table } from "./types";

// Serialize a (cleaned) Table back to CSV and trigger a download - all client-side.

// RTL scripts (Hebrew, Arabic, …). When a cell starts with one of these, spreadsheet
// apps flip the whole field/column to right-to-left. We strip stray directional
// control marks and prefix a LEFT-TO-RIGHT MARK (U+200E) so the exported text always
// reads left-to-right, regardless of the data's language or the user's locale.
const RTL = /[֐-ࣿ‏יִ-﷿ﹰ-﻿]/;
const DIR_MARKS = /[‎‏‪-‮⁦-⁩]/g;

function forceLtr(s: string): string {
  const clean = s.replace(DIR_MARKS, "");
  return RTL.test(clean) ? "‎" + clean : clean;
}

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const raw = typeof v === "boolean" ? (v ? "true" : "false") : String(v);
  const s = forceLtr(raw);
  // Quote if the value contains a comma, quote, or newline.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function tableToCsv(table: Table): string {
  const header = table.columns.map(escapeCell).join(",");
  const rows = table.rows.map((r) => table.columns.map((c) => escapeCell(r[c])).join(","));
  return [header, ...rows].join("\r\n");
}

/** Serialize an arbitrary set of rows to CSV, projecting (and ordering) only the given columns. */
export function rowsToCsv(columns: string[], rows: Array<Record<string, unknown>>): string {
  const header = columns.map(escapeCell).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCell(r[c])).join(","));
  return [header, ...body].join("\r\n");
}

/** Trigger a client-side download of CSV text under `filename` (a .csv extension is ensured). */
function triggerCsvDownload(csv: string, filename: string): void {
  // Prepend a UTF-8 BOM so Excel opens it with correct encoding.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.[^.]+$/, "") + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revocation: revoking the object URL synchronously after click can cancel the
  // download of a large blob (e.g. a cleaned 200k-row table) in some browsers before they've
  // started reading it. A short delay lets the download begin first.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadCsv(table: Table, filename: string): void {
  triggerCsvDownload(tableToCsv(table), filename.replace(/\.[^.]+$/, "") + "-cleaned");
}

/** Download a subset of rows (a segment worklist) as CSV - used by the insight→action exports. */
export function downloadRows(columns: string[], rows: Array<Record<string, unknown>>, filename: string): void {
  triggerCsvDownload(rowsToCsv(columns, rows), filename);
}
