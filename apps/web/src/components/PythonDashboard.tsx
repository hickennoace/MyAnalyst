"use client";

import { KpiCard } from "./KpiCard";
import { Chart } from "./Chart";
import { pyChartsToSpecs } from "@/lib/py-charts";
import type { PyAnalysisSpec, PyConclusions } from "@/lib/py-engine";

// Renders a Python-engine analysis spec (Phase 5). Reuses the existing KPI cards + ECharts <Chart> via the
// chart adapter, so a Python-computed dashboard looks identical to the TS one.

export function PythonDashboard({ spec, conclusions }: { spec: PyAnalysisSpec; conclusions?: PyConclusions | null }) {
  const charts = pyChartsToSpecs(spec.charts);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-100">
          {spec.rowCount.toLocaleString()} rows ·{" "}
          <span className="text-slate-400">{spec.domain.domain.replace("-", " ")}</span>
        </h2>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
          Python engine
        </span>
      </header>

      {conclusions && <ConclusionsCard c={conclusions} />}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {spec.kpis.slice(0, 8).map((k, i) => (
          <KpiCard key={k.id} kpi={k} index={i} />
        ))}
      </section>

      {charts.length > 0 && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {charts.map((c) => (
            <div key={c.id} className="card p-4">
              <h3 className="mb-1 text-sm font-semibold text-slate-100">{c.title}</h3>
              {c.subtitle && <p className="mb-2 text-[11px] text-slate-500">{c.subtitle}</p>}
              <Chart spec={c} />
            </div>
          ))}
        </section>
      )}

      <section className="card p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-100">What the numbers say</h3>
        <ul className="space-y-1.5">
          {spec.facts.map((f) => (
            <li key={f.id} className="flex gap-2 text-[13px] leading-relaxed text-slate-300">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" aria-hidden />
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ConclusionsCard({ c }: { c: PyConclusions }) {
  return (
    <section className="card border border-blue-500/20 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Conclusions</h3>
        <span className="text-[11px] text-slate-500">
          {c.provider === "groq" ? "AI-written" : "templated"} ·{" "}
          {c.grounding.grounded ? (
            <span className="text-emerald-400">✓ every figure traces to your data</span>
          ) : (
            <span className="text-amber-400">⚠ couldn&apos;t verify: {c.grounding.unverified.join(", ")}</span>
          )}
        </span>
      </div>
      {c.bottomLine && <p className="mt-2 text-[15px] font-medium text-slate-100">{c.bottomLine}</p>}
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
