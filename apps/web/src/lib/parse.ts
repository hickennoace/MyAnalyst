import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Table } from "./types";

/** Live progress while streaming a large delimited file. */
export interface ParseProgress {
  rows: number; // data rows scanned so far
  bytes: number; // bytes read so far
  totalBytes: number; // file size
}

/** One analyzable part of a file: a sheet (Excel) or a table (SQLite). Single for CSV/JSON. */
export interface SourceInfo {
  id: string;
  label: string;
  rowCount: number;
}

/** Result of parsing a file: the chosen source's Table plus the list of all sources so the UI can
 *  offer a picker for multi-sheet workbooks / multi-table databases. */
export interface ParseResult {
  table: Table;
  sources: SourceInfo[];
  sourceId: string;
  sourceKind?: "sheet" | "table";
}

function single(table: Table): ParseResult {
  return { table, sources: [{ id: "default", label: table.name, rowCount: table.rowCount }], sourceId: "default" };
}

// Browser memory limits for the formats we must load whole (no streaming parser exists for them here).
// CSV/TSV stream off disk and are effectively unbounded (handles ~1GB); Excel/JSON are read into memory
// and expand several-fold while parsing, so we cap them and point users to CSV for anything bigger.
const MAX_EXCEL_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_JSON_BYTES = 120 * 1024 * 1024; // 120 MB
const MAX_SQLITE_BYTES = 100 * 1024 * 1024; // 100 MB (loaded whole into a WASM SQLite engine)

/** Parse an uploaded File (CSV / TSV / TXT / JSON / XLSX / XLS / SQLite) into a normalized Table plus
 *  the list of its analyzable sources. `sourceId` targets a specific sheet/table (else a sensible
 *  default — first sheet / largest table). Runs entirely client-side. */
export async function parseFile(
  file: File,
  onProgress?: (p: ParseProgress) => void,
  sourceId?: string
): Promise<ParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "xlsx" || ext === "xls") {
    if (file.size > MAX_EXCEL_BYTES) {
      throw new Error(
        `This Excel file is ${(file.size / 1048576).toFixed(0)} MB. Excel can't be streamed in the browser, so it's capped at ${MAX_EXCEL_BYTES / 1048576} MB. Export it to CSV and upload that — CSV streams up to ~1 GB.`
      );
    }
    return parseExcel(file, sourceId);
  }
  if (ext === "json") {
    if (file.size > MAX_JSON_BYTES) {
      throw new Error(
        `This JSON file is ${(file.size / 1048576).toFixed(0)} MB. JSON must be loaded whole, so it's capped at ${MAX_JSON_BYTES / 1048576} MB. Convert it to CSV for larger datasets — CSV streams up to ~1 GB.`
      );
    }
    return single(await parseJson(file));
  }
  if (ext === "sqlite" || ext === "sqlite3" || ext === "db" || ext === "db3") {
    if (file.size > MAX_SQLITE_BYTES) {
      throw new Error(
        `This SQLite file is ${(file.size / 1048576).toFixed(0)} MB. It must be loaded whole into the in-browser SQLite engine, so it's capped at ${MAX_SQLITE_BYTES / 1048576} MB. Export the table you need to CSV for larger databases.`
      );
    }
    return parseSqlite(file, sourceId);
  }
  return single(await parseDelimited(file, onProgress));
}

// SQLite (.sqlite/.db/...): read the file into an in-browser WASM SQLite engine (sql.js), then pull
// the largest user table into a Table. sql.js is dynamically imported so its ~650KB wasm only loads
// when someone actually opens a database; the wasm is served locally from /sql-wasm.wasm.
async function parseSqlite(file: File, tableId?: string): Promise<ParseResult> {
  const initSqlJs = (await import("sql.js")).default;
  const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  const db = new SQL.Database(new Uint8Array(await file.arrayBuffer()));
  try {
    const tablesRes = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const names = tablesRes[0]?.values.map((r) => String(r[0])) ?? [];
    if (names.length === 0) throw new Error("No tables found in this SQLite database.");

    const sources: SourceInfo[] = names.map((n) => {
      const c = db.exec(`SELECT COUNT(*) FROM "${n.replace(/"/g, '""')}"`);
      return { id: n, label: n, rowCount: Number(c[0]?.values[0]?.[0] ?? 0) };
    });

    // Default to the largest table (usually the one worth analyzing) unless a specific one is asked for.
    const chosen =
      tableId && names.includes(tableId)
        ? tableId
        : [...sources].sort((a, b) => b.rowCount - a.rowCount)[0].id;
    const chosenCount = sources.find((s) => s.id === chosen)?.rowCount ?? 0;

    const out = db.exec(`SELECT * FROM "${chosen.replace(/"/g, '""')}" LIMIT ${SAMPLE_CAP}`);
    const name = `${file.name} · ${chosen}`;
    let table: Table;
    if (!out.length) {
      table = { name, columns: [], rows: [], rowCount: 0 };
    } else {
      const columns = out[0].columns.map((c) => String(c));
      const rows = out[0].values.map((vals) => {
        const o: Record<string, unknown> = {};
        columns.forEach((c, i) => {
          o[c] = vals[i];
        });
        return o;
      });
      table = { name, columns, rows, rowCount: rows.length };
      if (chosenCount > rows.length) table.sampledFrom = chosenCount; // hit the row cap
    }
    return { table, sources, sourceId: chosen, sourceKind: "table" };
  } finally {
    db.close();
  }
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

async function parseDelimited(file: File, onProgress?: (p: ParseProgress) => void): Promise<Table> {
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
        onProgress?.({ rows: total, bytes: results.meta.cursor ?? 0, totalBytes: file.size });
      },
      complete: () => {
        onProgress?.({ rows: total, bytes: file.size, totalBytes: file.size });
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

async function parseExcel(file: File, sheetId?: string): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetNames = wb.SheetNames.filter((n) => wb.Sheets[n]);
  if (sheetNames.length === 0) throw new Error("No sheets found in this Excel file.");

  // Approximate row count per sheet from its dimension range (cheap — avoids converting every sheet).
  const sources: SourceInfo[] = sheetNames.map((name) => {
    const ref = wb.Sheets[name]["!ref"];
    let rowCount = 0;
    if (ref) {
      const r = XLSX.utils.decode_range(ref);
      rowCount = Math.max(0, r.e.r - r.s.r); // minus the header row
    }
    return { id: name, label: name, rowCount };
  });

  const chosen = sheetId && sheetNames.includes(sheetId) ? sheetId : sheetNames[0];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[chosen], {
    defval: null,
    raw: false, // formatted strings, consistent with CSV path
  });
  const columns = json.length ? Object.keys(json[0]).map((c) => c.trim()) : [];
  const rows = json.filter((r) => r && Object.values(r).some((v) => v !== null && v !== ""));
  const name = sheetNames.length > 1 ? `${file.name} · ${chosen}` : file.name;
  return {
    table: { name, columns, rows, rowCount: rows.length },
    sources,
    sourceId: chosen,
    sourceKind: "sheet",
  };
}
