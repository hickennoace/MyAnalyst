import type { Table } from "./types";

// Serialize a (cleaned) Table back to CSV and trigger a download — all client-side.

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

export function downloadCsv(table: Table, filename: string): void {
  const csv = tableToCsv(table);
  // Prepend a UTF-8 BOM so Excel opens it with correct encoding.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.[^.]+$/, "") + "-cleaned.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
