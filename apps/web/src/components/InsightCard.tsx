import type { Insight } from "@/lib/types";

// Crafted stroke icons (24-grid, 1.5px) keyed by insight kind — matches the
// landing's icon language; no emoji.
const P: Record<Insight["kind"], React.ReactNode> = {
  summary: <><path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1Z" /><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 11h6M9 15h4" /></>,
  trend: <><path d="M4 18 10 12l3 3 7-8" /><path d="M16 7h4v4" /></>,
  correlation: <><path d="M9 12a3 3 0 0 1 3-3h2a3 3 0 0 1 0 6h-1" /><path d="M15 12a3 3 0 0 1-3 3h-2a3 3 0 0 1 0-6h1" /></>,
  regression: <><circle cx="7" cy="16" r="1" /><circle cx="11" cy="13" r="1" /><circle cx="14" cy="11" r="1" /><circle cx="18" cy="7" r="1" /><path d="M4 19 20 5" strokeDasharray="3 3" /></>,
  outlier: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></>,
  composition: <><path d="M12 3a9 9 0 1 0 9 9h-9V3Z" /><path d="M14 3a7 7 0 0 1 7 7h-7V3Z" /></>,
};

function KindIcon({ kind }: { kind: Insight["kind"] }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      {P[kind]}
    </svg>
  );
}

const CONF: Record<Insight["confidence"], string> = {
  high: "bg-emerald-500/15 text-emerald-300",
  medium: "bg-amber-500/15 text-amber-300",
  low: "bg-slate-500/15 text-slate-300",
};

export function InsightCard({ insight, index = 0 }: { insight: Insight; index?: number }) {
  return (
    <div className="card card-hover fade-up flex gap-3 p-4" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-500/15 text-blue-300">
        <KindIcon kind={insight.kind} />
      </div>
      <div className="flex-1">
        <p className="text-sm leading-relaxed text-slate-200">{insight.text}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${CONF[insight.confidence]}`}>
            {insight.confidence} confidence
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">{insight.kind}</span>
        </div>
      </div>
    </div>
  );
}
