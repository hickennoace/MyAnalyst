import type { ColumnProfile, OutlierFact } from "@/lib/types";
import { currencySymbol } from "@/lib/currency";

// Anomalies card: surfaces the unusual values the engine flagged (|z| > 3) per metric, with the
// typical range for context and a direction marker (above/below the average). Metadata-only - works on
// the read-only shared view too.

function fmt(n: number, p?: ColumnProfile): string {
  if (!Number.isFinite(n)) return "-";
  if (p?.type === "currency") return currencySymbol() + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

export function AnomalyCard({ anomalies, profiles }: { anomalies: OutlierFact[]; profiles: ColumnProfile[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Values more than 3 standard deviations from the average - unusually far from typical. Worth a look: a data-entry error, or a
        genuine rare event? A few extremes can quietly skew averages and trends.
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {anomalies.map((a) => {
          const p = profiles.find((x) => x.name === a.column);
          const mean = p?.numeric?.mean;
          return (
            <div key={a.column} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-100">{a.column}</span>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                  {a.count} unusual
                </span>
              </div>
              {p?.numeric && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Typical ≈ {fmt(p.numeric.mean, p)} (± {fmt(p.numeric.std, p)})
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.examples.map((e, i) => {
                  const high = mean !== undefined && e.value > mean;
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300"
                      title={`${e.z.toFixed(1)} standard deviations ${high ? "above" : "below"} the average`}
                    >
                      <span className={high ? "text-rose-300" : "text-sky-300"} aria-hidden>
                        {high ? "▲" : "▼"}
                      </span>
                      {fmt(e.value, p)}
                      <span className="text-slate-500">z={e.z.toFixed(1)}</span>
                    </span>
                  );
                })}
              </div>
              {a.breakdown && a.breakdown.length > 0 && (
                <div className="mt-2.5 border-t border-slate-800 pt-2">
                  <p className="text-[11px] font-medium text-slate-400">Most concentrated in</p>
                  <ul className="mt-1 space-y-0.5">
                    {a.breakdown.map((b, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate text-slate-300" title={`${b.dimension}: ${b.value}`}>
                          <span className="text-slate-500">{b.dimension}:</span> {b.value}
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-400">
                          {Math.round(b.outlierShare * 100)}% of anomalies
                          <span className="ml-1 rounded bg-amber-500/15 px-1 text-amber-300">{b.lift.toFixed(1)}× expected</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
