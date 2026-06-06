import type { Kpi } from "@/lib/types";

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const trend = kpi.trend;
  const trendColor =
    trend === undefined ? "" : trend > 0 ? "text-emerald-400" : trend < 0 ? "text-rose-400" : "text-slate-400";
  const arrow = trend === undefined ? "" : trend > 0 ? "▲" : trend < 0 ? "▼" : "—";

  return (
    <div className="card group p-4" title={kpi.howComputed}>
      <div className="flex items-center justify-between">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">{kpi.name}</p>
        {trend !== undefined && (
          <span className={`text-xs font-semibold ${trendColor}`}>
            {arrow} {Math.abs(trend * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-50">
        {kpi.value}
        {kpi.unit && <span className="ml-1 text-sm font-medium text-slate-400">{kpi.unit}</span>}
      </p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">{kpi.howComputed}</p>
    </div>
  );
}
