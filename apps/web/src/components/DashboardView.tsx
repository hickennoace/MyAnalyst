import type { Ref } from "react";
import type { DashboardSpec, Table } from "@/lib/types";
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
          <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300">
            {spec.domain.domain} · {(spec.domain.confidence * 100).toFixed(0)}% confidence
          </span>
          <p className="mt-1 max-w-md text-[11px] text-slate-500">{spec.domain.reason}</p>
        </div>
      </div>

      {spec.story && (
        <div className="card flex gap-3 p-5">
          <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">About this data</h3>
              <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
                {spec.story.industry}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{spec.story.summary}</p>
          </div>
        </div>
      )}

      <Section title="Cleaning &amp; normalization" subtitle="The unglamorous core that makes everything below trustworthy.">
        <CleaningReport report={spec.cleaning} />
      </Section>

      <Section title="Key metrics" subtitle="Auto-selected for this dataset's shape and domain.">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {spec.kpis.slice(0, 8).map((kpi, i) => (
            <KpiCard key={kpi.id} kpi={kpi} index={i} />
          ))}
        </div>
      </Section>

      {spec.insights.length > 0 && (
        <Section
          title="What the data is telling you"
          subtitle="The most important, statistically-backed findings — and what to do about them."
          badge={
            spec.narrator === "llm" ? (
              <span className="rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
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
          <span className="section-accent" aria-hidden />
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="ml-7 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
