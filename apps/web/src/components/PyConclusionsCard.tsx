"use client";

import type { PyConclusions } from "@/lib/py-engine";

// The AI (Groq) conclusions panel: reads the computed KPIs + charts and explains them. Shown above the
// dashboard so uploads get a decision-first executive read on top of the full analysis.

export function PyConclusionsCard({ c }: { c: PyConclusions }) {
  return (
    <section className="card border border-blue-500/20 p-5">
      <h3 className="font-display text-[15px] font-semibold text-slate-100">AI conclusions</h3>
      {c.bottomLine && <p className="font-display mt-2 text-[19px] font-medium leading-snug text-slate-100">{c.bottomLine}</p>}
      {c.summary && <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{c.summary}</p>}
      {c.chartInsights && c.chartInsights.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What the charts show</div>
          {c.chartInsights.map((ci, i) => (
            <div key={i} className="flex gap-2 text-[12px] leading-relaxed text-slate-300">
              <span className="shrink-0 font-medium text-slate-400">{ci.chart}:</span>
              <span>{ci.insight}</span>
            </div>
          ))}
        </div>
      )}
      {c.conclusions.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {c.conclusions.map((t, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-slate-300">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
      {c.actions.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
          {c.actions.map((a, i) => (
            <div key={i}>
              <div className="text-[13px] font-semibold text-slate-200">→ {a.title}</div>
              <div className="text-[12px] text-slate-400">{a.detail}</div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 border-t border-slate-800 pt-3 text-[11px] text-slate-500">{c.disclaimer}</p>
    </section>
  );
}
