"use client";

import { useMemo, useState } from "react";
import type { ColumnProfile, Table } from "@/lib/types";
import { parseNumeric } from "@/lib/profile";

// Browsable view of the dataset: search, click-to-sort, pagination. Lightweight, no table library.

const PAGE_SIZE = 10;
const NUMERIC_TYPES = new Set(["number", "currency", "percent", "integer"]);

export function DataTable({ table, profiles }: { table: Table; profiles: ColumnProfile[] }) {
  const [query, setQuery] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const typeOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of profiles) m[p.name] = p.type;
    return m;
  }, [profiles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return table.rows;
    return table.rows.filter((r) => table.columns.some((c) => String(r[c] ?? "").toLowerCase().includes(q)));
  }, [query, table]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const numeric = NUMERIC_TYPES.has(typeOf[sortCol]);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (numeric) return (parseNumeric(av) - parseNumeric(bv)) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [filtered, sortCol, sortDir, typeOf]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
    setPage(0);
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Data</h3>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Search all columns…"
          className="w-56 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/60 text-slate-400">
            <tr>
              {table.columns.map((c) => (
                <th
                  key={c}
                  onClick={() => toggleSort(c)}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium transition hover:text-slate-200"
                  title="Click to sort"
                >
                  {c}
                  {sortCol === c && <span className="ml-1 text-indigo-400">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t border-slate-800/70 hover:bg-slate-800/30">
                {table.columns.map((c) => {
                  const numeric = NUMERIC_TYPES.has(typeOf[c]);
                  return (
                    <td
                      key={c}
                      className={`whitespace-nowrap px-3 py-1.5 ${numeric ? "text-right tabular-nums text-slate-200" : "text-slate-300"}`}
                    >
                      {String(r[c] ?? "—")}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={table.columns.length} className="px-3 py-6 text-center text-slate-500">
                  No rows match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>
          {sorted.length.toLocaleString()} row{sorted.length === 1 ? "" : "s"}
          {query && ` (filtered from ${table.rowCount.toLocaleString()})`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="rounded-lg border border-slate-700 px-2.5 py-1 transition hover:bg-slate-800/60 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span>
            {safePage + 1} / {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            className="rounded-lg border border-slate-700 px-2.5 py-1 transition hover:bg-slate-800/60 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
