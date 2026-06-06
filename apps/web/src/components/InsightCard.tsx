import type { Insight } from "@/lib/types";

const ICONS: Record<Insight["kind"], string> = {
  summary: "📋",
  trend: "📈",
  correlation: "🔗",
  regression: "🧮",
  outlier: "⚠️",
  composition: "🥧",
};

const CONF: Record<Insight["confidence"], string> = {
  high: "bg-emerald-500/15 text-emerald-300",
  medium: "bg-amber-500/15 text-amber-300",
  low: "bg-slate-500/15 text-slate-300",
};

export function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="card card-hover flex gap-3 p-4">
      <div className="text-lg leading-none">{ICONS[insight.kind]}</div>
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
