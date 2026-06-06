import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Table } from "./types";

/** Parse an uploaded File (CSV / TSV / JSON / XLSX / XLS) into a normalized Table. Runs entirely client-side. */
export async function parseFile(file: File): Promise<Table> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "xlsx" || ext === "xls") return parseExcel(file);
  if (ext === "json") return parseJson(file);
  return parseDelimited(file);
}

async function parseJson(file: File): Promise<Table> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("That JSON file couldn't be parsed. Make sure it's valid JSON.");
  }

  // Accept: an array of objects, or an object whose first array-of-objects property holds the records.
  let records: Record<string, unknown>[];
  if (Array.isArray(data)) {
    records = data as Record<string, unknown>[];
  } else if (data && typeof data === "object") {
    const arr = Object.values(data as Record<string, unknown>).find(
      (v) => Array.isArray(v) && v.length > 0 && typeof v[0] === "object"
    ) as Record<string, unknown>[] | undefined;
    records = arr ?? [data as Record<string, unknown>];
  } else {
    throw new Error("JSON must be an array of records (or an object containing one).");
  }

  const rows = records.filter((r) => r && typeof r === "object" && !Array.isArray(r));
  if (rows.length === 0) throw new Error("No records found in that JSON file.");

  // Columns = union of keys across the first rows; flatten nested values to a readable string.
  const columns: string[] = [];
  for (const r of rows.slice(0, 200)) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k);
  const normalized = rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) {
      const v = r[c];
      out[c] = v !== null && typeof v === "object" ? JSON.stringify(v) : v ?? null;
    }
    return out;
  });

  return { name: file.name, columns, rows: normalized, rowCount: normalized.length };
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
