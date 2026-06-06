import type { Ref } from "react";
import type { Conclusion, DashboardSpec, Table } from "@/lib/types";
import { DISCLAIMER } from "@/lib/conclusions";
import { KpiCard } from "./KpiCard";
import { Chart } from "./Chart";
import { InsightCard } from "./InsightCard";
import { ChartBuilder } from "./ChartBuilder";
import { CleaningReport } from "./CleaningReport";
import { QueryBox } from "./QueryBox";
import { DataTable } from "./DataTable";

// The dashboard body, rendered identically by the live analyzer (/analyze) and the read-only
// shared view (/view). Everything renders from the DashboardSpec alone; the interactive chart
// builder only appears when the raw `table` is available (i.e. not on a shared link).

export function DashboardView({
  spec,
  table,
  innerRef,
}: {
  spec: DashboardSpec;
  table?: Table | null;
  innerRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="space-y-8" ref={innerRef}>
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-100">{spec.datasetName}</p>
          <p className="text-xs text-slate-400">
            {spec.rowCount.toLocaleString()} rows · {spec.profiles.length} columns
          </p>
        </div>
        <div className="text-right">
          <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300">
            {spec.domain.domain} · {(spec.domain.confidence * 100).toFixed(0)}% confidence
          </span>
          <p className="mt-1 max-w-md text-[11px] text-slate-500">{spec.domain.reason}</p>
        </div>
      </div>

      <Section title="Cleaning &amp; normalization" subtitle="The unglamorous core that makes everything below trustworthy.">
        <CleaningReport report={spec.cleaning} />
      </Section>

      <Section title="Key metrics" subtitle="Auto-selected for this dataset's shape and domain.">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {spec.kpis.slice(0, 8).map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} />
          ))}
        </div>
      </Section>

      {spec.insights.length > 0 && (
        <Section
          title="What the data is telling you"
          subtitle="Plain-language conclusions, grounded in the computed numbers."
          badge={
            spec.narrator === "llm" ? (
              <span className="rounded-full bg-gradient-to-r from-indigo-500/20 to-violet-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                ✨ AI-narrated
              </span>
            ) : undefined
          }
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {spec.insights.map((ins) => (
              <InsightCard key={ins.id} insight={ins} />
            ))}
          </div>
        </Section>
      )}

      {spec.conclusions.length > 0 && (
        <Section
          title="Conclusions &amp; recommendations"
          subtitle="What the numbers may mean for you — interpreted, not just described."
          badge={
            <span className="rounded-full bg-gradient-to-r from-indigo-500/20 to-violet-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
              ✨ AI-generated
            </span>
          }
        >
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
            <span className="mt-0.5">⚠️</span>
            <span>{DISCLAIMER}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {spec.conclusions.map((c) => (
              <ConclusionCard key={c.id} conclusion={c} />
            ))}
          </div>
        </Section>
      )}

      {spec.charts.length > 0 && (
        <Section title="Automatic charts" subtitle="The engine picked these from your data shape.">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {spec.charts.map((c) => (
              <Chart key={c.id} spec={c} />
            ))}
          </div>
        </Section>
      )}

      {table && (
        <Section title="Ask your data" subtitle="Plain-English questions, answered with your real numbers — no AI key needed.">
          <QueryBox table={table} profiles={spec.profiles} />
        </Section>
      )}

      {table && (
        <Section title="Build your own" subtitle="Ask for any chart you want — in plain English or by picking columns.">
          <ChartBuilder table={table} profiles={spec.profiles} />
        </Section>
      )}

      {table && (
        <Section title="Browse the data" subtitle="Search, sort, and page through every row.">
          <DataTable table={table} profiles={spec.profiles} />
        </Section>
      )}
    </div>
  );
}

const CONF_STYLE: Record<Conclusion["confidence"], string> = {
  high: "bg-emerald-500/15 text-emerald-300",
  medium: "bg-amber-500/15 text-amber-300",
  low: "bg-slate-500/15 text-slate-300",
};

function ConclusionCard({ conclusion }: { conclusion: Conclusion }) {
  return (
    <div className="card flex gap-3 p-4">
      <div className="text-lg leading-none">💡</div>
      <div className="flex-1">
        <p className="text-sm leading-relaxed text-slate-200">{conclusion.text}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${CONF_STYLE[conclusion.confidence]}`}>
            {conclusion.confidence} confidence
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">based on {conclusion.basis}</span>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
