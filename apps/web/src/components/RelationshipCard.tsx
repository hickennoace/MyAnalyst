"use client";

import { useMemo, useState } from "react";
import type { ColumnProfile, RelationshipMatrix, Table } from "@/lib/types";
import { numericColumn } from "@/lib/profile";
import { linearRegression } from "@/lib/stats";

// Relationship explorer: an interactive correlation heatmap. Hover/click any cell to drill into that
// pair - a scatter with its fitted trend line, the correlation strength, significance, 95% CI, and an
// honest "correlation isn't causation" reminder. The matrix is precomputed; the scatter is drawn from
// the raw table when it's available (live analyzer + read-only shared view both pass it through).

/** Diverging blue↔red shade for a correlation r in [-1, 1] (blue = negative, red = positive). */
function cellBg(r: number): string {
  if (!Number.isFinite(r)) return "transparent";
  const a = Math.min(0.85, 0.12 + Math.abs(r) * 0.73);
  return r >= 0 ? `rgba(239,68,68,${a.toFixed(3)})` : `rgba(56,138,255,${a.toFixed(3)})`;
}

function Scatter({ table, xName, yName }: { table: Table; xName: string; yName: string }) {
  const { pts, line } = useMemo(() => {
    const xs = numericColumn(table, xName);
    const ys = numericColumn(table, yName);
    const all: [number, number][] = [];
    for (let i = 0; i < xs.length; i++) if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) all.push([xs[i], ys[i]]);
    // Sample for a clean, fast plot.
    const stride = Math.max(1, Math.floor(all.length / 300));
    const pts = all.filter((_, i) => i % stride === 0);
    const reg = linearRegression(xs, ys);
    return { pts, line: reg };
  }, [table, xName, yName]);

  if (pts.length < 3) return <p className="text-[11px] text-slate-500">Not enough paired points to plot.</p>;

  const W = 320, H = 180, pad = 6;
  const xsv = pts.map((p) => p[0]);
  const ysv = pts.map((p) => p[1]);
  const xmin = Math.min(...xsv), xmax = Math.max(...xsv);
  const ymin = Math.min(...ysv), ymax = Math.max(...ysv);
  const sx = (x: number) => pad + ((x - xmin) / (xmax - xmin || 1)) * (W - 2 * pad);
  const sy = (y: number) => H - pad - ((y - ymin) / (ymax - ymin || 1)) * (H - 2 * pad);
  const lineY1 = line.slope * xmin + line.intercept;
  const lineY2 = line.slope * xmax + line.intercept;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label={`Scatter of ${yName} versus ${xName}`}>
      <line x1={sx(xmin)} y1={sy(lineY1)} x2={sx(xmax)} y2={sy(lineY2)} stroke="rgba(148,163,184,0.7)" strokeWidth="1.5" strokeDasharray="4 3" />
      {pts.map((p, i) => (
        <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="2.2" fill="rgba(56,138,255,0.6)" />
      ))}
    </svg>
  );
}

export function RelationshipCard({ relationships, table, profiles }: { relationships: RelationshipMatrix; table?: Table | null; profiles: ColumnProfile[] }) {
  const { columns, matrix, pairs } = relationships;
  const strongest = pairs.find((p) => !p.redundant) ?? pairs[0];
  const [sel, setSel] = useState<{ a: string; b: string } | null>(strongest ? { a: strongest.a, b: strongest.b } : null);

  const selPair = sel ? pairs.find((p) => (p.a === sel.a && p.b === sel.b) || (p.a === sel.b && p.b === sel.a)) : undefined;
  const shortName = (n: string) => (n.length > 10 ? n.slice(0, 9) + "…" : n);

  return (
    <div className="card p-5">
      <p className="mb-3 text-xs text-slate-400">
        How every pair of numbers moves together. <span className="text-rose-300">Red</span> = rise together,{" "}
        <span className="text-sky-300">blue</span> = move opposite, stronger color = tighter link. Click a cell to drill in.
      </p>

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        {/* Heatmap */}
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1 text-[10px]">
            <thead>
              <tr>
                <th />
                {columns.map((c) => (
                  <th key={c} className="px-1 py-0.5 font-medium text-slate-500" title={c}>
                    {shortName(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map((rowName, i) => (
                <tr key={rowName}>
                  <td className="whitespace-nowrap py-0.5 pr-1 text-right font-medium text-slate-400" title={rowName}>
                    {shortName(rowName)}
                  </td>
                  {columns.map((colName, j) => {
                    const r = matrix[i][j];
                    const isSel = !!sel && ((sel.a === rowName && sel.b === colName) || (sel.a === colName && sel.b === rowName));
                    const diag = i === j;
                    return (
                      <td key={colName} className="p-0">
                        <button
                          type="button"
                          disabled={diag}
                          onClick={() => setSel({ a: rowName, b: colName })}
                          title={`${rowName} vs ${colName}: r = ${Number.isFinite(r) ? r.toFixed(2) : "-"}`}
                          style={{ background: diag ? "rgba(100,116,139,0.25)" : cellBg(r) }}
                          className={`grid h-8 w-8 place-items-center rounded tabular-nums text-slate-100 transition ${
                            isSel ? "ring-2 ring-white/70" : ""
                          } ${diag ? "cursor-default" : "hover:ring-2 hover:ring-white/40"}`}
                        >
                          {diag ? "" : Number.isFinite(r) ? r.toFixed(1) : "·"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Drill-down */}
        <div className="min-w-0">
          {selPair ? (
            <div className="rounded-xl border border-[var(--line)] bg-slate-900/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-100">
                  {selPair.a} <span className="text-slate-500">vs</span> {selPair.b}
                </h4>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    selPair.strength === "strong" ? "bg-violet-500/15 text-violet-300" : selPair.strength === "moderate" ? "bg-sky-500/15 text-sky-300" : "bg-slate-700/50 text-slate-400"
                  }`}
                >
                  {selPair.r >= 0 ? "+" : "−"}
                  {Math.abs(selPair.r).toFixed(2)} · {selPair.strength}
                </span>
              </div>

              {table ? (
                <div className="mt-2">
                  <Scatter table={table} xName={selPair.a} yName={selPair.b} />
                </div>
              ) : null}

              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400">
                <div className="flex justify-between"><dt>Significance</dt><dd className={selPair.significant ? "text-emerald-300" : "text-slate-500"}>{selPair.significant ? `p = ${selPair.p < 0.001 ? "<0.001" : selPair.p.toFixed(3)}` : "not significant"}</dd></div>
                <div className="flex justify-between"><dt>95% CI</dt><dd className="tabular-nums text-slate-300">[{selPair.ciLow.toFixed(2)}, {selPair.ciHigh.toFixed(2)}]</dd></div>
                <div className="flex justify-between"><dt>Paired n</dt><dd className="tabular-nums text-slate-300">{selPair.n.toLocaleString()}</dd></div>
                <div className="flex justify-between"><dt>R²</dt><dd className="tabular-nums text-slate-300">{(selPair.r * selPair.r).toFixed(2)}</dd></div>
              </dl>

              {selPair.redundant && (
                <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300">
                  ⚠ This pair is near-perfectly correlated - one column is likely derived from the other, not an independent finding.
                </p>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                A relationship isn't proof of cause - both can be driven by something else. Treat it as a lead to investigate, not a conclusion.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Pick a cell to explore a pair.</p>
          )}
        </div>
      </div>
    </div>
  );
}
