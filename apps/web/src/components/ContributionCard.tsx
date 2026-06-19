import type { ColumnProfile, ContributionAnalysis } from "@/lib/types";
import { cadenceNoun } from "@/lib/timeseries";
import { currencySymbol } from "@/lib/currency";

// "What drove the change" card: the primary metric's move from the previous period to the latest,
// broken down by a dimension into per-segment contributions that sum to the total. A waterfall-style
// bar per segment (green = pushed the total up, rose = dragged it down) plus the mix-shift (share
// gained/lost). Renders from precomputed analysis - works on the read-only shared view too.

function fmt(n: number, p?: ColumnProfile): string {
  if (!Number.isFinite(n)) return "-";
  if (p?.type === "currency") return currencySymbol() + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

function signed(n: number, p?: ColumnProfile): string {
  return (n >= 0 ? "+" : "−") + fmt(Math.abs(n), p);
}

const statusLabel: Record<ContributionAnalysis["segments"][number]["status"], string> = {
  grew: "grew", shrank: "shrank", new: "new", lost: "dropped out", flat: "flat",
};

export function ContributionCard({ analysis, profiles }: { analysis: ContributionAnalysis; profiles: ColumnProfile[] }) {
  const p = profiles.find((x) => x.name === analysis.metric);
  const noun = cadenceNoun(analysis.cadence);
  const up = analysis.totalDelta >= 0;
  // Scale bars to the largest single contribution so the biggest mover fills the row.
  const maxAbs = Math.max(...analysis.segments.map((s) => Math.abs(s.delta)), 1e-9);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-100">{analysis.metric} by {analysis.dimension}</p>
          <p className="text-[11px] text-slate-500">
            {analysis.prevLabel} → {analysis.latestLabel} · per {noun}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold tabular-nums ${up ? "text-emerald-300" : "text-rose-300"}`}>
            {signed(analysis.totalDelta, p)}
          </p>
          {analysis.totalDeltaPct !== null && (
            <p className="text-[11px] text-slate-500">{(analysis.totalDeltaPct * 100).toFixed(1)}% vs prior {noun}</p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {analysis.segments.map((s) => {
          const segUp = s.delta >= 0;
          const widthPct = (Math.abs(s.delta) / maxAbs) * 100;
          const shareShift = s.shareLatest - s.sharePrev;
          return (
            <div key={s.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="truncate text-slate-200" title={s.name}>{s.name}</span>
                {s.status === "new" && <span className="rounded bg-sky-500/15 px-1.5 text-[10px] font-medium text-sky-300">new</span>}
                {s.status === "lost" && <span className="rounded bg-slate-700/60 px-1.5 text-[10px] font-medium text-slate-400">dropped</span>}
              </div>
              <span className={`justify-self-end tabular-nums font-semibold ${segUp ? "text-emerald-300" : "text-rose-300"}`}>
                {signed(s.delta, p)}
              </span>
              {/* waterfall bar: centred axis, grows right (up) or left (down) */}
              <div className="col-span-2 flex items-center" aria-hidden>
                <div className="flex h-1.5 w-1/2 justify-end">
                  {!segUp && <div className="h-full rounded-l bg-rose-400/70" style={{ width: `${widthPct}%` }} />}
                </div>
                <div className="h-3 w-px bg-slate-600" />
                <div className="flex h-1.5 w-1/2 justify-start">
                  {segUp && <div className="h-full rounded-r bg-emerald-400/70" style={{ width: `${widthPct}%` }} />}
                </div>
              </div>
              <p className="col-span-2 -mt-0.5 text-[10px] text-slate-500">
                {/* Show the share-of-change only when it's a sensible figure. Offsetting segments make
                    delta/totalDelta exceed 100% legitimately (e.g. 120%), but a near-flat total can blow
                    it up to absurd values - past ~300% fall back to the plain status word. */}
                {Math.abs(s.contributionPct) >= 0.01 && Math.abs(s.contributionPct) <= 3
                  ? `${(s.contributionPct * 100).toFixed(0)}% of the change`
                  : statusLabel[s.status]}
                {Math.abs(shareShift) >= 0.02 && (
                  <span className={shareShift > 0 ? " text-emerald-400/80" : " text-rose-400/80"}>
                    {" · "}{shareShift > 0 ? "+" : "−"}{Math.abs(shareShift * 100).toFixed(0)}pts share
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-3 border-t border-slate-800 pt-2 text-[11px] text-slate-500">
        Contributions sum to the total change ({signed(analysis.totalDelta, p)}). Share shift shows which segments gained or lost
        ground in the mix.
      </p>
    </div>
  );
}
