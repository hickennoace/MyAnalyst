import type { Table } from "./types";

// Serialize a (cleaned) Table back to CSV and trigger a download — all client-side.

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "true" : "false") : String(v);
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
