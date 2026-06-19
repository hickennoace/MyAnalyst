import type { Table } from "./types";

// Reconstruct a tabular grid from positioned text tokens - the shared core behind PDF-table extraction
// and image OCR. Both produce {x, y, str, width} tokens; we cluster them into lines (by y), split each
// line into cells (by horizontal gaps), pick the dominant column count, and emit a Table. Heuristic by
// nature (real-world PDFs/screenshots vary wildly), so it fails loudly with a helpful message when the
// content doesn't look like a table. Pure + dependency-free → unit-testable without a real PDF/image.

export interface PositionedToken {
  x: number;
  y: number;
  str: string;
  width: number;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Group tokens into visual lines by y (within `yTol`), each sorted left→right. */
function toLines(tokens: PositionedToken[], yTol: number): PositionedToken[][] {
  const sorted = [...tokens].sort((a, b) => b.y - a.y || a.x - b.x); // top→bottom (PDF y grows upward)
  const lines: PositionedToken[][] = [];
  for (const t of sorted) {
    const line = lines.find((l) => Math.abs(l[0].y - t.y) <= yTol);
    if (line) line.push(t);
    else lines.push([t]);
  }
  for (const l of lines) l.sort((a, b) => a.x - b.x);
  return lines;
}

/** Split one line into cells wherever the horizontal gap between tokens exceeds `gap`. */
function lineToCells(line: PositionedToken[], gap: number): string[] {
  const cells: string[] = [];
  let cur = "";
  let prevEnd = -Infinity;
  for (const t of line) {
    if (cur && t.x - prevEnd > gap) {
      cells.push(cur.trim());
      cur = "";
    }
    cur += (cur ? " " : "") + t.str.trim();
    prevEnd = t.x + t.width;
  }
  if (cur.trim()) cells.push(cur.trim());
  return cells;
}

function mode(counts: number[]): number {
  const freq = new Map<number, number>();
  for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
  let best = 0;
  let bestN = 0;
  for (const [c, n] of freq) if (c >= 2 && (n > bestN || (n === bestN && c > best))) { best = c; bestN = n; }
  return best;
}

function uniqueHeaders(cells: string[]): string[] {
  const seen = new Map<string, number>();
  return cells.map((raw, i) => {
    let name = raw.trim() || `Column ${i + 1}`;
    if (seen.has(name)) {
      const n = seen.get(name)! + 1;
      seen.set(name, n);
      name = `${name} ${n}`;
    } else seen.set(name, 1);
    return name;
  });
}

/** Build a Table from positioned tokens. Throws a friendly error when no table-like grid is found. */
export function itemsToTable(tokens: PositionedToken[], name: string): Table {
  const clean = tokens.filter((t) => t.str && t.str.trim().length > 0);
  if (clean.length < 4) throw new Error("Not enough text was found to extract a table.");

  const heights = clean.map((t) => t.width / Math.max(1, t.str.trim().length));
  const charW = median(heights) || 4;
  const gap = Math.max(charW * 1.6, 6); // a column break is a gap noticeably wider than a space
  const yTol = Math.max(charW, 3);

  const lines = toLines(clean, yTol);
  const rows = lines.map((l) => lineToCells(l, gap)).filter((r) => r.length > 0);
  const target = mode(rows.map((r) => r.length));
  if (target < 2) throw new Error("Couldn't detect columns - this doesn't look like a table. Try a CSV/Excel export.");

  // Keep rows that have at least 2 cells; normalize each to `target` columns (pad short, merge overflow).
  const grid = rows
    .filter((r) => r.length >= 2)
    .map((r) => {
      if (r.length === target) return r;
      if (r.length < target) return [...r, ...Array(target - r.length).fill("")];
      return [...r.slice(0, target - 1), r.slice(target - 1).join(" ")];
    });
  if (grid.length < 2) throw new Error("Found only a header or a single row - not enough to analyze.");

  const headers = uniqueHeaders(grid[0]);
  const dataRows = grid.slice(1).map((cells) => {
    const o: Record<string, unknown> = {};
    headers.forEach((h, i) => (o[h] = cells[i] ?? ""));
    return o;
  });

  return { name, columns: headers, rows: dataRows, rowCount: dataRows.length };
}
