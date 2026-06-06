import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Table } from "./types";

/** Parse an uploaded File (CSV / TSV / XLSX / XLS) into a normalized Table. Runs entirely client-side. */
export async function parseFile(file: File): Promise<Table> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "xlsx" || ext === "xls") return parseExcel(file);
  return parseDelimited(file);
}

async function parseDelimited(file: File): Promise<Table> {
  const text = await file.text();
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    dynamicTyping: false, // keep strings; our profiler does typing so we control currency/percent parsing
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const columns = (result.meta.fields ?? []).filter((c) => c && c.length > 0);
  const rows = (result.data as Record<string, unknown>[]).filter(
    (r) => r && Object.values(r).some((v) => v !== null && v !== "")
  );
  return { name: file.name, columns, rows, rowCount: rows.length };
}

async function parseExcel(file: File): Promise<Table> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false, // formatted strings, consistent with CSV path
  });
  const columns = json.length ? Object.keys(json[0]).map((c) => c.trim()) : [];
  const rows = json.filter(
    (r) => r && Object.values(r).some((v) => v !== null && v !== "")
  );
  return { name: file.name, columns, rows, rowCount: rows.length };
}
