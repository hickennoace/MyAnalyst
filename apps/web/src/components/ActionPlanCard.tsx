import type { ActionItem } from "@/lib/types";

// The action plan: a ranked, quantified "what to do next" list — the consultant-style deliverable,
// generated instantly and grounded in the analysis. Renders from precomputed actions.

const IMPACT: Record<ActionItem["impact"], { ring: string; text: string; label: string }> = {
  high: { ring: "border-rose-500/30 bg-rose-500/[0.06]", text: "text-rose-300", label: "High impact" },
  medium: { ring: "border-amber-500/30 bg-amber-500/[0.05]", text: "text-amber-300", label: "Medium impact" },
  low: { ring: "border-slate-700 bg-slate-900/40", text: "text-slate-400", label: "Worth a look" },
};

export function ActionPlanCard({ actions }: { actions: ActionItem[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Prioritized, specific next steps — generated from your data, ranked by impact. Each is grounded in the real numbers above.
      </p>
      <ol className="space-y-3">
        {actions.map((a, i) => {
          const tone = IMPACT[a.impact];
          return (
            <li key={a.id} className={`card border ${tone.ring} flex gap-4 p-4`}>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-800/70 text-sm font-bold text-slate-200">
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-100">{a.title}</h4>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.text}`}>
                    {tone.label}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{a.detail}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">Based on: {a.basis}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
