import type { DatasetComparison, MetricChange } from "@/lib/compare-datasets";
import type { SemanticType } from "@/lib/types";

// Shows the ranked "what changed" between the current dataset and a second uploaded file.

function fmt(n: number, type: SemanticType): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const compact = abs >= 1e6 ? (n / 1e6).toFixed(1) + "M" : abs >= 1e4 ? (n / 1e3).toFixed(1) + "K" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
  return type === "currency" ? "$" + compact : compact;
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-500">—</span>;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-emerald-300" : "text-rose-300"}`}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function ComparisonCard({ comparison, onClose }: { comparison: DatasetComparison; onClose: () => void }) {
  const c = comparison;
  return (
    <div className="card border border-blue-500/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">What changed</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            <span className="text-slate-300">{c.nameA}</span> → <span className="text-slate-300">{c.nameB}</span> · rows {c.rowsA.toLocaleString()} → {c.rowsB.toLocaleString()}{" "}
            <Delta pct={c.rowDeltaPct} />
          </p>
        </div>
        <button onClick={onClose} aria-label="Close comparison" className="rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200">
          ✕
        </button>
      </div>

      {c.metrics.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-3 font-medium">Metric</th>
                <th className="py-1 pr-3 text-right font-medium">Total {c.nameA}</th>
                <th className="py-1 pr-3 text-right font-medium">Total {c.nameB}</th>
                <th className="py-1 pr-3 text-right font-medium">Δ total</th>
                <th className="py-1 text-right font-medium">Δ avg</th>
              </tr>
            </thead>
            <tbody>
              {c.metrics.map((m: MetricChange) => (
                <tr key={m.metric} className="border-t border-slate-800">
                  <td className="py-1.5 pr-3 text-slate-200">{m.metric}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400">{fmt(m.sumA, m.type)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-100">{fmt(m.sumB, m.type)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    <Delta pct={m.sumDeltaPct} />
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Delta pct={m.meanDeltaPct} />
                      {m.meanSignificant !== undefined && (
                        <span
                          className={`rounded px-1 text-[10px] font-medium ${m.meanSignificant ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/60 text-slate-400"}`}
                          title={m.meanP !== undefined ? `Welch's t-test p = ${m.meanP < 0.001 ? "<0.001" : m.meanP.toFixed(3)}` : undefined}
                        >
                          {m.meanSignificant ? "real" : "n.s."}
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-500">
            “real” = the difference in averages is statistically significant (Welch’s t-test, p &lt; 0.05); “n.s.” = within what
            chance could produce, so treat it as noise.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">No shared numeric columns to compare. Make sure both files use the same column names.</p>
      )}

      {(c.onlyInA.length > 0 || c.onlyInB.length > 0) && (
        <p className="mt-3 text-[11px] text-slate-500">
          {c.onlyInA.length > 0 && <>Only in {c.nameA}: {c.onlyInA.join(", ")}. </>}
          {c.onlyInB.length > 0 && <>Only in {c.nameB}: {c.onlyInB.join(", ")}.</>}
        </p>
      )}
    </div>
  );
}
