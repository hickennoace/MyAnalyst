import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Table } from "./types";
import { itemsToTable, type PositionedToken } from "./table-extract";

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
const MAX_EXCEL_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_JSON_BYTES = 250 * 1024 * 1024; // 250 MB
const MAX_SQLITE_BYTES = 250 * 1024 * 1024; // 250 MB (loaded whole into a WASM SQLite engine)
const MAX_PARQUET_BYTES = 500 * 1024 * 1024; // 500 MB (read whole into memory by hyparquet)
const MAX_PDF_BYTES = 60 * 1024 * 1024; // 60 MB (text-positioned extraction)
const MAX_IMAGE_BYTES = 40 * 1024 * 1024; // 40 MB (OCR)

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
  if (ext === "parquet" || ext === "pq") {
    if (file.size > MAX_PARQUET_BYTES) {
      throw new Error(
        `This Parquet file is ${(file.size / 1048576).toFixed(0)} MB. It's read whole into memory, so it's capped at ${MAX_PARQUET_BYTES / 1048576} MB. Export a subset to CSV for larger files.`
      );
    }
    return single(await parseParquet(file));
  }
  if (ext === "pdf") {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error(`This PDF is ${(file.size / 1048576).toFixed(0)} MB — capped at ${MAX_PDF_BYTES / 1048576} MB for table extraction. Try a smaller file or export the table to CSV.`);
    }
    return single(await parsePdf(file));
  }
  if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`This image is ${(file.size / 1048576).toFixed(0)} MB — capped at ${MAX_IMAGE_BYTES / 1048576} MB for OCR.`);
    }
    return single(await parseImage(file, onProgress));
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

// Parquet (.parquet): read with hyparquet — a pure-JS reader (no WASM), dynamically imported so it only
// loads when someone opens a Parquet file. We read up to SAMPLE_CAP rows and flag the rest as sampled.
async function parseParquet(file: File): Promise<Table> {
  const { parquetReadObjects, parquetMetadataAsync, toJson } = await import("hyparquet");
  const ab = await file.arrayBuffer();
  const buffer = { byteLength: ab.byteLength, slice: (start: number, end?: number) => ab.slice(start, end) };
  let total = 0;
  try {
    const meta = await parquetMetadataAsync(buffer);
    total = Number(meta.num_rows ?? 0);
  } catch {
    // metadata read failed — fall through; reading objects will surface a clearer error if truly broken
  }
  const rowEnd = total > 0 ? Math.min(total, SAMPLE_CAP) : SAMPLE_CAP;
  let raw: Record<string, unknown>[];
  try {
    raw = (await parquetReadObjects({ file: buffer, rowStart: 0, rowEnd })) as Record<string, unknown>[];
  } catch {
    throw new Error("That Parquet file couldn't be read. It may be corrupt or use an unsupported encoding.");
  }
  if (!raw.length) throw new Error("No rows found in that Parquet file.");

  // Columns = union of keys across the first rows; flatten nested/BigInt values to readable strings.
  const columns: string[] = [];
  for (const r of raw.slice(0, 200)) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k);
  const rows = raw.map((r) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) {
      const v = toJson(r[c]);
      out[c] = v !== null && typeof v === "object" ? JSON.stringify(v) : (v ?? null);
    }
    return out;
  });
  return {
    name: file.name,
    columns,
    rows,
    rowCount: rows.length,
    sampledFrom: total > rows.length ? total : undefined,
  };
}

// PDF (.pdf): extract positioned text with pdf.js (dynamically imported), then reconstruct a table from
// token coordinates. Best-effort — works well on real tabular PDFs, less so on heavily-formatted ones.
async function parsePdf(file: File): Promise<Table> {
  const pdfjs = await import("pdfjs-dist");
  // Bundler-resolved worker URL (Turbopack/webpack understand new URL(..., import.meta.url)).
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const tokens: PositionedToken[] = [];
  let yOffset = 0;
  const maxPages = Math.min(doc.numPages, 15); // cap work on huge PDFs
  for (let p = 1; p <= maxPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const it = item as { str: string; width: number; transform: number[] };
      if (!it.str.trim()) continue;
      // Stack pages downward (PDF y grows upward) so a table spanning pages stays in order.
      tokens.push({ x: it.transform[4], y: it.transform[5] + yOffset, str: it.str, width: it.width });
    }
    yOffset -= viewport.height + 20;
  }
  return itemsToTable(tokens, file.name);
}

// Image (.png/.jpg/.webp): OCR with tesseract.js, then reconstruct a table. Prefers per-word bounding
// boxes (positioned reconstruction); falls back to splitting text lines on multi-space gaps. The OCR
// engine + language data download on first use (the one network touch in this path).
async function parseImage(file: File, onProgress?: (p: ParseProgress) => void): Promise<Table> {
  const Tesseract = await import("tesseract.js");
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read that image."));
    r.readAsDataURL(file);
  });
  const { data } = await Tesseract.recognize(dataUrl, "eng", {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.({ rows: 0, bytes: Math.round((m.progress || 0) * file.size), totalBytes: file.size });
    },
  });

  const words = (data as { words?: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }).words ?? [];
  if (words.length >= 4) {
    // image y grows downward → negate so the top row sorts first in itemsToTable
    const tokens: PositionedToken[] = words
      .filter((w) => w.text.trim())
      .map((w) => ({ x: w.bbox.x0, y: -w.bbox.y0, str: w.text, width: w.bbox.x1 - w.bbox.x0 }));
    return itemsToTable(tokens, file.name);
  }

  // Fallback: split recognized lines on runs of 2+ spaces.
  const lines = (data.text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const rows = lines.map((l) => l.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean)).filter((r) => r.length >= 2);
  if (rows.length < 2) throw new Error("Couldn't read a table from that image. A clearer screenshot or a CSV export will work better.");
  const target = rows[0].length;
  const headers = rows[0].map((h, i) => h || `Column ${i + 1}`);
  const dataRows = rows.slice(1).map((cells) => {
    const o: Record<string, unknown> = {};
    headers.forEach((h, i) => (o[h] = cells[i] ?? ""));
    return o;
  });
  void target;
  return { name: file.name, columns: headers, rows: dataRows, rowCount: dataRows.length };
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

// A safe arithmetic evaluator (recursive descent over + - * / and parentheses) — NO eval/Function, so it
// works under the strict production CSP. Used to compute formula cells that were saved without a result.
export function evalArithmetic(expr: string): number | null {
  const tokens = expr.match(/\d+\.?\d*|[+\-*/()]/g);
  if (!tokens) return null;
  let pos = 0;
  const peek = () => tokens[pos];
  const parseExpr = (): number => {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") { const op = tokens[pos++]; const r = parseTerm(); v = op === "+" ? v + r : v - r; }
    return v;
  };
  const parseTerm = (): number => {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/") { const op = tokens[pos++]; const r = parseFactor(); v = op === "*" ? v * r : v / r; }
    return v;
  };
  const parseFactor = (): number => {
    const t = peek();
    if (t === "(") { pos++; const v = parseExpr(); if (peek() === ")") pos++; return v; }
    if (t === "-") { pos++; return -parseFactor(); }
    if (t === "+") { pos++; return parseFactor(); }
    return Number(tokens[pos++]);
  };
  const v = parseExpr();
  return pos === tokens.length && Number.isFinite(v) ? v : null;
}

// Excel files often store DERIVED columns as formulas (e.g. Total = Salary*12 + Bonus). Many are saved
// without cached results — those cells then read as blank ("100% missing"). Resolve such cells by
// evaluating their formula: substitute referenced cells with their (recursively resolved) numeric values,
// then compute the resulting arithmetic. Only pure arithmetic formulas are supported (the common case);
// anything else (functions, ranges, cross-sheet refs) is left blank.
export function fillFormulaCells(ws: XLSX.WorkSheet): void {
  const ref = ws["!ref"];
  if (!ref) return;
  const resolve = (addr: string, stack: Set<string>): number | null => {
    const cell = ws[addr] as XLSX.CellObject | undefined;
    if (!cell) return null;
    // A real cached numeric value (type "n"). Formula stubs come back as type "z" with a placeholder v:0,
    // so don't trust their value — evaluate the formula instead.
    if (cell.t === "n" && typeof cell.v === "number") return cell.v;
    if (typeof cell.f === "string") {
      if (stack.has(addr)) return null; // circular reference guard
      return evalFormula(cell.f, new Set(stack).add(addr));
    }
    const n = Number(cell.v);
    return Number.isFinite(n) ? n : null;
  };
  const evalFormula = (formula: string, stack: Set<string>): number | null => {
    let expr = formula.replace(/^=/, "");
    if (expr.includes("!")) return null; // cross-sheet refs unsupported
    expr = expr.replace(/\$?([A-Z]{1,3})\$?(\d+)/g, (_m, col, row) => {
      const v = resolve(col + row, stack);
      return v === null ? "NaN" : `(${v})`;
    });
    if (!/^[\d.+\-*/()\s]+$/.test(expr)) return null; // arithmetic only (rejects leftover NaN/letters)
    return evalArithmetic(expr.replace(/\s+/g, ""));
  };
  const range = XLSX.utils.decode_range(ref);
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      // Fill formula cells with no genuine value: a stub (type "z") or an empty value.
      if (cell && typeof cell.f === "string" && (cell.t === "z" || cell.v === undefined || cell.v === null)) {
        const val = evalFormula(cell.f, new Set([addr]));
        if (val !== null) {
          cell.t = "n";
          cell.v = val;
          delete cell.w; // drop stale formatted text; sheet_to_json regenerates it from v + number format
        }
      }
    }
  }
}

async function parseExcel(file: File, sheetId?: string): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  // sheetStubs + cellFormula materialize formula cells that have no cached value (otherwise SheetJS drops
  // them entirely); cellNF keeps each cell's number format so the recomputed values still render with units.
  const wb = XLSX.read(buf, { type: "array", cellDates: true, cellFormula: true, cellNF: true, sheetStubs: true });
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
  // Compute any formula cells that were saved without a cached result (derived columns like
  // Total = Salary*12 + Bonus) so they don't read as blank.
  fillFormulaCells(wb.Sheets[chosen]);
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
