import type { CohortAnalysis } from "@/lib/types";
import { cadenceNoun } from "@/lib/timeseries";

// Cohort retention heatmap: rows are cohorts (by first-seen period), columns are periods-since, cells
// shaded by retention %. Renders from precomputed analysis - works on the read-only shared view too.

/** Blue shade scaled by retention %, for the heatmap cells. */
function cellStyle(pct: number | null): React.CSSProperties {
  if (pct === null) return { background: "transparent" };
  const a = 0.08 + (pct / 100) * 0.6;
  return { background: `rgba(56,138,255,${a.toFixed(3)})` };
}

export function CohortCard({ cohorts }: { cohorts: CohortAnalysis }) {
  const noun = cadenceNoun(cohorts.cadence);
  const offsets = Array.from({ length: cohorts.periodCount }, (_, i) => i);

  return (
    <div className="card overflow-x-auto p-5">
      <p className="mb-3 text-xs text-slate-400">
        Each row is a cohort of {cohorts.entity}s grouped by the {noun} they first appeared; cells show what share
        were still active that many {noun}s later. Brighter = stickier.
      </p>
      <table className="w-full border-separate border-spacing-1 text-[11px]">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left font-medium text-slate-400">Cohort</th>
            <th className="px-2 py-1 text-right font-medium text-slate-400">Size</th>
            {offsets.map((o) => (
              <th key={o} className="px-2 py-1 text-center font-medium text-slate-500">
                +{o}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.cohorts.map((c) => (
            <tr key={c.label}>
              <td className="whitespace-nowrap px-2 py-1 text-slate-300">{c.label}</td>
              <td className="px-2 py-1 text-right tabular-nums text-slate-400">{c.size.toLocaleString()}</td>
              {offsets.map((o) => {
                const v = c.retention[o] ?? null;
                return (
                  <td key={o} className="rounded px-2 py-1 text-center tabular-nums text-slate-100" style={cellStyle(v)}>
                    {v === null ? "" : `${v}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
