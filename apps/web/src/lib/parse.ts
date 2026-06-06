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

// Above this size we stream the file in chunks and keep a representative random
// sample instead of loading the whole thing into memory — so even a 750MB CSV is
// analyzable without freezing or crashing the tab.
const STREAM_THRESHOLD = 24 * 1024 * 1024; // 24 MB
const SAMPLE_CAP = 200_000; // max rows kept for analysis when sampling

function isEmptyRow(r: Record<string, unknown>): boolean {
  for (const k in r) {
    const v = r[k];
    if (v !== null && v !== undefined && v !== "") return false;
  }
  return true;
}

async function parseDelimited(file: File): Promise<Table> {
  // Small/medium files: parse the whole thing in one pass (exact, simplest).
  if (file.size <= STREAM_THRESHOLD) {
    const text = await file.text();
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      dynamicTyping: false, // keep strings; our profiler does typing so we control currency/percent parsing
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });
    const columns = (result.meta.fields ?? []).filter((c) => c && c.length > 0);
    const rows = (result.data as Record<string, unknown>[]).filter((r) => r && !isEmptyRow(r));
    return { name: file.name, columns, rows, rowCount: rows.length };
  }

  // Large files: stream chunks off disk (parsed in a Web Worker so the UI stays
  // responsive) and keep a uniform random sample via reservoir sampling.
  // NOTE: worker mode can't accept config functions (the config is posted to the
  // worker), so header trimming is done here by hand instead of `transformHeader`.
  return new Promise<Table>((resolve, reject) => {
    let rawFields: string[] = []; // header names exactly as they appear in the file
    let columns: string[] = []; // trimmed, used for display/keys
    let renameMap: Record<string, string> | null = null; // raw → trimmed, only if trimming changed something
    let total = 0; // total data rows scanned across the whole file
    const sample: Record<string, unknown>[] = [];

    const normalize = (row: Record<string, unknown>): Record<string, unknown> => {
      if (!renameMap) return row;
      const out: Record<string, unknown> = {};
      for (const raw of rawFields) out[renameMap[raw]] = row[raw];
      return out;
    };

    const consider = (row: Record<string, unknown>) => {
      total++;
      const r = normalize(row);
      if (sample.length < SAMPLE_CAP) {
        sample.push(r);
      } else {
        // Replace an existing slot with probability SAMPLE_CAP/total → uniform sample.
        const j = Math.floor(Math.random() * total);
        if (j < SAMPLE_CAP) sample[j] = r;
      }
    };

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: "greedy",
      worker: true,
      chunk: (results) => {
        if (!rawFields.length && results.meta.fields) {
          rawFields = results.meta.fields.filter((c) => c && c.length > 0);
          columns = rawFields.map((c) => c.trim());
          if (columns.some((c, i) => c !== rawFields[i])) {
            renameMap = Object.fromEntries(rawFields.map((raw, i) => [raw, columns[i]]));
          }
        }
        for (const row of results.data as Record<string, unknown>[]) {
          if (row && !isEmptyRow(row)) consider(row);
        }
      },
      complete: () => {
        if (!columns.length && sample.length) columns = Object.keys(sample[0]);
        resolve({
          name: file.name,
          columns,
          rows: sample,
          rowCount: sample.length,
          sampledFrom: total > sample.length ? total : undefined,
        });
      },
      error: (err) => reject(new Error(`Couldn't read that file: ${err.message}`)),
    });
  });
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
