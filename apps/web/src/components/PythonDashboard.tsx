"use client";

import type { ReactNode } from "react";
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

      {spec.bestSellers && (
        <Section title={`Best sellers by ${spec.bestSellers.dimension}`}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {spec.bestSellers.byRevenue.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2">
                <span className="truncate text-[13px] text-slate-200">
                  <span className="text-slate-500">{i + 1}.</span> {p.name}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-slate-400">
                  {money(p.revenue)} · {(p.revenueShare * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {spec.rfm && spec.rfm.segments.length > 0 && (
        <Section title={`Customer value (RFM) · ${spec.rfm.customers.toLocaleString()} ${spec.rfm.entity}s`}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {spec.rfm.segments.map((s) => (
              <div key={s.key} className="rounded-lg border border-[var(--line)] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-slate-100">{s.label}</span>
                  <span className="text-[11px] text-slate-400">{s.size} · {s.sharePct.toFixed(0)}%</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {(s.monetaryShare * 100).toFixed(0)}% of revenue · avg {money(s.avgMonetary)}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {spec.segments && spec.segments.segments.length > 1 && (
        <Section title={`Natural segments (clustered on ${spec.segments.features.join(", ")})`}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {spec.segments.segments.map((s) => (
              <div key={s.id} className="rounded-lg border border-[var(--line)] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-slate-100">{s.label}</span>
                  <span className="text-[11px] text-slate-400">{s.sharePct.toFixed(0)}%</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{s.size.toLocaleString()} rows</div>
              </div>
            ))}
          </div>
        </Section>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-100">{title}</h3>
      {children}
    </section>
  );
}

function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + n.toFixed(0);
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
