import type { Table } from "./types";

// Multi-table joins. SQLite databases and Excel workbooks expose several tables/sheets; this lets the
// user enrich one with another (the classic fact × dimension join — e.g. orders + customers). We
// auto-suggest the join key by name match and value overlap, then do a left lookup join: every left row
// is kept and gains the matching right row's columns (first match on a one-to-many). Pure + worker-safe.

export interface JoinKeySuggestion {
  leftKey: string;
  rightKey: string;
  /** fraction of (non-empty) left key values that have a match in the right table, 0..1. */
  overlap: number;
  /** whether the right key is unique — a clean one-to-one lookup. */
  rightUnique: boolean;
}

const norm = (v: unknown): string => String(v ?? "").trim().toLowerCase();
const squash = (s: string): string => s.toLowerCase().replace(/[\s_-]/g, "");
const baseName = (n: string): string => n.replace(/\.[^.]+$/, "");

/** Rank plausible join-key pairs between two tables (best first). */
export function suggestJoinKeys(left: Table, right: Table, sampleRows = 2000): JoinKeySuggestion[] {
  const leftRows = left.rows.slice(0, sampleRows);
  const rightRows = right.rows.slice(0, sampleRows);

  // Precompute right value multisets once per column.
  const rightSets = right.columns.map((rc) => {
    const m = new Map<string, number>();
    for (const r of rightRows) {
      const k = norm(r[rc]);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return { rc, m };
  });

  const out: JoinKeySuggestion[] = [];
  for (const lc of left.columns) {
    for (const { rc, m } of rightSets) {
      if (m.size === 0) continue;
      const nameMatch = squash(lc) === squash(rc);
      let matched = 0;
      let leftNonEmpty = 0;
      for (const r of leftRows) {
        const k = norm(r[lc]);
        if (!k) continue;
        leftNonEmpty++;
        if (m.has(k)) matched++;
      }
      if (leftNonEmpty === 0) continue;
      const overlap = matched / leftNonEmpty;
      // Keep strong candidates: a shared name with decent overlap, or very high overlap regardless of name.
      if ((nameMatch && overlap >= 0.5) || overlap >= 0.9) {
        out.push({ leftKey: lc, rightKey: rc, overlap, rightUnique: [...m.values()].every((c) => c === 1) });
      }
    }
  }
  // Prefer a unique right key (clean lookup), then a name match, then higher overlap.
  return out.sort(
    (a, b) =>
      Number(b.rightUnique) - Number(a.rightUnique) ||
      Number(squash(b.leftKey) === squash(b.rightKey)) - Number(squash(a.leftKey) === squash(a.rightKey)) ||
      b.overlap - a.overlap
  );
}

/**
 * Left lookup join: keep every left row, append the right table's columns from the first row whose
 * `rightKey` matches the left row's `leftKey`. Colliding column names get a " (2)" suffix. `inner`
 * drops left rows with no match.
 */
export function joinTables(
  left: Table,
  right: Table,
  leftKey: string,
  rightKey: string,
  type: "left" | "inner" = "left"
): Table {
  const lookup = new Map<string, Record<string, unknown>>();
  for (const r of right.rows) {
    const k = norm(r[rightKey]);
    if (k && !lookup.has(k)) lookup.set(k, r);
  }

  const leftSet = new Set(left.columns.map((c) => c.toLowerCase()));
  const rightCols = right.columns.filter((c) => c !== rightKey);
  const rename = new Map<string, string>();
  for (const c of rightCols) rename.set(c, leftSet.has(c.toLowerCase()) ? `${c} (2)` : c);

  const columns = [...left.columns, ...rightCols.map((c) => rename.get(c)!)];
  const rows: Record<string, unknown>[] = [];
  for (const lr of left.rows) {
    const match = lookup.get(norm(lr[leftKey]));
    if (!match && type === "inner") continue;
    const row: Record<string, unknown> = { ...lr };
    for (const c of rightCols) row[rename.get(c)!] = match ? match[c] : null;
    rows.push(row);
  }

  return { name: `${baseName(left.name)} + ${baseName(right.name)}`, columns, rows, rowCount: rows.length };
}
