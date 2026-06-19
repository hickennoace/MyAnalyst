import type { DashboardSpec } from "@/lib/types";
import { buildExecutiveSummary } from "@/lib/report";

// The opening of the report: a synthesized, plain-language executive summary. Leads the dashboard and
// the exported PDF/PNG. Pure render from the spec.

export function ExecutiveSummary({ spec }: { spec: DashboardSpec }) {
  const paras = buildExecutiveSummary(spec);
  if (!paras.length) return null;

  return (
    <div className="card relative overflow-hidden p-5">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#ff5740]/70 to-[#ff8a4c]/40" aria-hidden />
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Executive summary</h3>
        <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          auto-generated
        </span>
      </div>
      <div className="mt-2 space-y-2">
        {paras.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-slate-300">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
