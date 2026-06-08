import type { RfmAnalysis, RfmSegment } from "@/lib/types";

// RFM card: the customer-value segments (Champions, Loyal, At Risk, …) found by scoring every customer
// on Recency, Frequency, and Monetary value. Each tile shows the segment's size, its share of revenue,
// and the average R/F/M behind it — so "who are my best customers and who's slipping" is one glance.

function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return "$" + (n / 1e3).toFixed(1) + "k";
  return "$" + n.toFixed(0);
}

const TONE: Record<string, string> = {
  champions: "border-emerald-500/40 bg-emerald-500/5",
  loyal: "border-blue-500/40 bg-blue-500/5",
  potential: "border-cyan-500/30 bg-cyan-500/5",
  "at-risk": "border-amber-500/40 bg-amber-500/5",
  hibernating: "border-slate-600/50 bg-slate-800/20",
  attention: "border-violet-500/30 bg-violet-500/5",
};

function Tile({ s, maxShare }: { s: RfmSegment; maxShare: number }) {
  return (
    <div className={`rounded-xl border p-4 ${TONE[s.key] ?? "border-[var(--line)]"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-100">{s.label}</span>
        <span className="rounded-full bg-slate-900/50 px-2 py-0.5 text-[11px] font-medium text-slate-300">
          {s.size.toLocaleString()} · {s.sharePct.toFixed(0)}%
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-400">{s.blurb}</p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
        <div>
          <div className="tabular-nums text-slate-200">{Math.round(s.avgRecencyDays)}d</div>
          <div className="text-slate-500">since last</div>
        </div>
        <div>
          <div className="tabular-nums text-slate-200">{s.avgFrequency.toFixed(1)}×</div>
          <div className="text-slate-500">orders</div>
        </div>
        <div>
          <div className="tabular-nums text-slate-200">{money(s.avgMonetary)}</div>
          <div className="text-slate-500">avg value</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>share of revenue</span>
          <span className="tabular-nums text-slate-400">{(s.monetaryShare * 100).toFixed(0)}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-800/60">
          <div className="h-full rounded bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${Math.max(2, (s.monetaryShare / maxShare) * 100).toFixed(1)}%` }} />
        </div>
      </div>
    </div>
  );
}

export function RfmCard({ rfm }: { rfm: RfmAnalysis }) {
  const maxShare = Math.max(...rfm.segments.map((s) => s.monetaryShare), 0.01);
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        {rfm.customers.toLocaleString()} {rfm.entity}s scored on Recency, Frequency, and Monetary value
        (spend = {rfm.valueColumn}, as of {rfm.asOf}). Tiles are ordered by total revenue.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rfm.segments.map((s) => (
          <Tile key={s.key} s={s} maxShare={maxShare} />
        ))}
      </div>
    </div>
  );
}
