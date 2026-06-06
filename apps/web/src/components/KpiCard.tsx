import type { Kpi } from "@/lib/types";
import { AnimatedValue } from "./AnimatedValue";

export function KpiCard({ kpi, index = 0 }: { kpi: Kpi; index?: number }) {
  const trend = kpi.trend;
  const trendColor =
    trend === undefined ? "" : trend > 0 ? "text-emerald-400" : trend < 0 ? "text-rose-400" : "text-slate-400";
  const arrow = trend === undefined ? "" : trend > 0 ? "▲" : trend < 0 ? "▼" : "—";

  return (
    <div className="card card-hover fade-up group p-4" style={{ animationDelay: `${index * 45}ms` }} title={kpi.howComputed}>
      <div className="flex items-center justify-between">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">{kpi.name}</p>
        {trend !== undefined && (
          <span className={`text-xs font-semibold ${trendColor}`}>
            {arrow} {Math.abs(trend * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-2xl font-bold tracking-tight text-slate-50">
          <AnimatedValue value={kpi.value} />
          {kpi.unit && <span className="ml-1 text-sm font-medium text-slate-400">{kpi.unit}</span>}
        </p>
        {kpi.spark && kpi.spark.length > 1 && (
          <Sparkline values={kpi.spark} up={trend === undefined ? true : trend >= 0} />
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">{kpi.howComputed}</p>
    </div>
  );
}

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  const w = 72;
  const h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke = up ? "#34d399" : "#fb7185";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
