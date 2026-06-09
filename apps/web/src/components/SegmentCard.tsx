import { useMemo } from "react";
import type { ColumnProfile, Segmentation, Table } from "@/lib/types";
import { segmentMembers } from "@/lib/segment";
import { DownloadCsvButton } from "./DownloadCsvButton";
import { currencySymbol } from "@/lib/currency";

// Segmentation card: the natural groups found by clustering, each with its share of rows and the
// features that set it apart (▲ high / ▼ low vs the overall average). Renders from precomputed data.

function fmt(n: number, p?: ColumnProfile): string {
  if (!Number.isFinite(n)) return "—";
  if (p?.type === "currency") return currencySymbol() + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
}

const TONE = ["border-blue-500/30", "border-violet-500/30", "border-emerald-500/30", "border-amber-500/30"];

export function SegmentCard({ segmentation, profiles, table }: { segmentation: Segmentation; profiles: ColumnProfile[]; table?: Table | null }) {
  const { segments, features, sampled } = segmentation;
  // Per-row cluster assignment, recomputed from the raw table on demand (live analyzer only).
  const byCluster = useMemo(() => {
    if (!table) return undefined;
    const members = segmentMembers(table, profiles);
    if (!members) return undefined;
    const map = new Map<number, number[]>();
    for (const m of members) {
      const list = map.get(m.cluster) ?? [];
      list.push(m.rowIndex);
      map.set(m.cluster, list);
    }
    return map;
  }, [table, profiles]);
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Clustered on {features.join(", ")} — the data splits into {segments.length} natural group{segments.length > 1 ? "s" : ""}.
        {sampled ? ` Based on a ${sampled.toLocaleString()}-row sample.` : ""}
        {byCluster ? " Download any group's rows as CSV." : ""}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {segments.map((s, i) => (
          <div key={s.id} className={`card border ${TONE[i % TONE.length]} p-4`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-100">{s.label}</span>
              <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                {s.sharePct.toFixed(0)}%
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">{s.size.toLocaleString()} rows</p>
            <div className="mt-2 space-y-1">
              {s.defining.map((d) => {
                const p = profiles.find((x) => x.name === d.column);
                return (
                  <div key={d.column} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-slate-300">
                      <span className={d.direction === "high" ? "text-emerald-300" : "text-sky-300"} aria-hidden>
                        {d.direction === "high" ? "▲" : "▼"}
                      </span>
                      {d.column}
                    </span>
                    <span className="tabular-nums text-slate-400">avg {fmt(d.mean, p)}</span>
                  </div>
                );
              })}
            </div>
            {table && byCluster?.get(s.id)?.length ? (
              <div className="mt-3 border-t border-slate-700/50 pt-2.5">
                <DownloadCsvButton
                  columns={table.columns}
                  rows={byCluster.get(s.id)!.map((ri) => table.rows[ri])}
                  filename={`segment-${s.id + 1}`}
                  label={`Download ${byCluster.get(s.id)!.length.toLocaleString()} rows`}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
