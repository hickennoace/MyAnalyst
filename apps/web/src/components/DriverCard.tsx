import type { DriverAnalysis } from "@/lib/types";

// Driver analysis, in plain language: the multiple-regression model that asks which numeric factors
// most move the primary metric, each holding the others constant. Bars are the standardized effect (β),
// so they're comparable across factors. Renders from precomputed DriverAnalysis.

export function DriverCard({ drivers }: { drivers: DriverAnalysis }) {
  const ranked = [...drivers.drivers].sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));
  const maxBeta = Math.max(...ranked.map((d) => Math.abs(d.beta)), 0.0001);
  const weakFit = drivers.fP >= 0.05 || drivers.r2 < 0.1;

  return (
    <div className="card p-5">
      <p className="text-sm leading-relaxed text-slate-300">
        Of the numeric factors, these most move <span className="font-semibold text-slate-100">{drivers.target}</span> — together they
        explain <span className="font-semibold text-slate-100">{Math.round(drivers.r2 * 100)}%</span> of its variation
        {weakFit ? " (a weak overall fit — treat as a hint, not a rule)" : ""}.
      </p>

      <div className="mt-4 space-y-2.5">
        {ranked.map((d) => {
          const up = d.beta >= 0;
          const w = Math.max(4, (Math.abs(d.beta) / maxBeta) * 100);
          return (
            <div key={d.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-200">
                  <span className={up ? "text-emerald-300" : "text-rose-300"} aria-hidden>
                    {up ? "▲" : "▼"}
                  </span>
                  {d.name}
                  {!d.significant && <span className="text-[10px] text-slate-500">· not significant</span>}
                </span>
                <span className="tabular-nums text-slate-400">β {d.beta.toFixed(2)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${up ? "bg-emerald-400/70" : "bg-rose-400/70"} ${d.significant ? "" : "opacity-40"}`}
                  style={{ width: `${w}%`, transition: "width 700ms cubic-bezier(0.22,1,0.36,1)" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        β is the standardized effect — a longer bar moves {drivers.target} more, holding the other factors constant. This shows
        association, not proof of cause. Based on {drivers.n.toLocaleString()} rows.
      </p>
    </div>
  );
}
