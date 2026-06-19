import type { ColumnProfile, TimeSeriesAnalysis } from "@/lib/types";
import { cadenceNoun } from "@/lib/timeseries";
import { currencySymbol } from "@/lib/currency";

// Period-over-period card: for each top metric, the latest period's value, its change vs the previous
// period (and vs a year ago when available), a sparkline with a moving-average overlay, and the
// best/worst periods. Renders from precomputed analysis — works on the read-only shared view too.

function fmt(n: number, p?: ColumnProfile): string {
  if (!Number.isFinite(n)) return "—";
  if (p?.type === "currency") return currencySymbol() + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

function Delta({ pct, label }: { pct: number; label: string }) {
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${up ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {Math.abs(pct * 100).toFixed(1)}% {label}
    </span>
  );
}

function Sparkline({ values, ma }: { values: number[]; ma: (number | null)[] }) {
  const W = 240;
  const H = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (values.length === 1 ? W / 2 : (i / (values.length - 1)) * W);
  const y = (v: number) => H - ((v - min) / span) * (H - 6) - 3;
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const maPts = ma.map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean) as string[];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#ff5740]" />
      {maPts.length > 1 && <polyline points={maPts.join(" ")} fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="text-slate-500" />}
    </svg>
  );
}

// A one-line plain-English takeaway that ties the periods together: the overall move across the whole
// series (start → latest) and whether the latest reading sits above or below the period average — the
// "so what" the deltas and sparkline only imply.
function trendRead(a: TimeSeriesAnalysis, p: ColumnProfile | undefined, noun: string): string {
  const vals = a.periods.map((q) => q.value).filter((v) => Number.isFinite(v));
  if (vals.length < 2) return "";
  const first = vals[0];
  const latest = a.latest.value;
  const overall = first ? (latest - first) / Math.abs(first) : 0;
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  const dir = overall > 0.02 ? "climbed" : overall < -0.02 ? "declined" : "held roughly flat";
  const mag = Math.abs(overall) > 0.02 ? ` about ${Math.abs(overall * 100).toFixed(0)}%` : "";
  const vsAvg = latest > avg * 1.02 ? "above" : latest < avg * 0.98 ? "below" : "in line with";
  return `Across ${vals.length} ${noun}s, ${a.metric} ${dir}${mag} (${fmt(first, p)} → ${fmt(latest, p)}). The latest ${noun} sits ${vsAvg} the period average.`;
}

export function TimeTrendCard({ analyses, profiles }: { analyses: TimeSeriesAnalysis[]; profiles: ColumnProfile[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {analyses.map((a) => {
        const p = profiles.find((x) => x.name === a.metric);
        const noun = cadenceNoun(a.cadence);
        const read = trendRead(a, p, noun);
        return (
          <div key={a.metric} className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-100">{a.metric}</p>
                <p className="text-[11px] text-slate-500">
                  by {noun} · {a.periods.length} periods · latest {a.latest.label}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {a.changePct !== undefined && <Delta pct={a.changePct} label={`vs last ${noun}`} />}
                {a.yoyChangePct !== undefined && <Delta pct={a.yoyChangePct} label="YoY" />}
              </div>
            </div>

            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-100">{fmt(a.latest.value, p)}</p>

            <div className="mt-2 text-[#ff5740]">
              <Sparkline values={a.periods.map((q) => q.value)} ma={a.movingAvg} />
            </div>

            <div className="mt-2 flex justify-between text-[11px] text-slate-500">
              <span>Best: {a.best.label} ({fmt(a.best.value, p)})</span>
              <span>Worst: {a.worst.label} ({fmt(a.worst.value, p)})</span>
            </div>

            {read && <p className="mt-2 text-[12px] leading-relaxed text-slate-300">{read}</p>}

            {a.seasonality && (
              <p className="mt-2 rounded-lg bg-violet-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-violet-200">
                <span className="font-semibold">Seasonal pattern:</span> peaks in {a.seasonality.peak.label}{" "}
                (+{Math.round((a.seasonality.peak.index - 1) * 100)}% vs the {a.seasonality.unit} average), lowest in{" "}
                {a.seasonality.trough.label} ({Math.round((a.seasonality.trough.index - 1) * 100)}%).
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
