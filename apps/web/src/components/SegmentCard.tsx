import type { ColumnProfile, Segmentation } from "@/lib/types";

// Segmentation card: the natural groups found by clustering, each with its share of rows and the
// features that set it apart (▲ high / ▼ low vs the overall average). Renders from precomputed data.

function fmt(n: number, p?: ColumnProfile): string {
  if (!Number.isFinite(n)) return "—";
  if (p?.type === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
}

const TONE = ["border-blue-500/30", "border-violet-500/30", "border-emerald-500/30", "border-amber-500/30"];

export function SegmentCard({ segmentation, profiles }: { segmentation: Segmentation; profiles: ColumnProfile[] }) {
  const { segments, features, sampled } = segmentation;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Clustered on {features.join(", ")} — the data splits into {segments.length} natural group{segments.length > 1 ? "s" : ""}.
        {sampled ? ` Based on a ${sampled.toLocaleString()}-row sample.` : ""}
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
          </div>
        ))}
      </div>
    </div>
  );
}
