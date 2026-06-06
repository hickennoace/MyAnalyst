"use client";

import type { Ref } from "react";
import type { Conclusion, DashboardSpec, Table } from "@/lib/types";
import { useT, type AppDict } from "@/lib/i18n";
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
  const t = useT();
  return (
    <div className="space-y-8" ref={innerRef}>
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-100">{spec.datasetName}</p>
          <p className="text-xs text-slate-400">
            {spec.rowCount.toLocaleString()} {t.dash.rows} · {spec.profiles.length} {t.dash.cols}
          </p>
        </div>
        <div className="text-right">
          <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300">
            {spec.domain.domain} · {(spec.domain.confidence * 100).toFixed(0)}% {t.dash.confidence}
          </span>
          <p className="mt-1 max-w-md text-[11px] text-slate-500">{spec.domain.reason}</p>
        </div>
      </div>

      <Section title={t.dash.cleaningTitle} subtitle={t.dash.cleaningSub}>
        <CleaningReport report={spec.cleaning} />
      </Section>

      <Section title={t.dash.kpisTitle} subtitle={t.dash.kpisSub}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {spec.kpis.slice(0, 8).map((kpi, i) => (
            <KpiCard key={kpi.id} kpi={kpi} index={i} />
          ))}
        </div>
      </Section>

      {spec.insights.length > 0 && (
        <Section
          title={t.dash.insightsTitle}
          subtitle={t.dash.insightsSub}
          badge={
            spec.narrator === "llm" ? (
              <span className="rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                ✨ {t.dash.aiNarrated}
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
          title={t.dash.conclusionsTitle}
          subtitle={t.dash.conclusionsSub}
          badge={
            <span className="rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
              ✨ {t.dash.aiGenerated}
            </span>
          }
        >
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
            <span className="mt-0.5">⚠️</span>
            <span>{t.dash.disclaimer}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {spec.conclusions.map((c) => (
              <ConclusionCard key={c.id} conclusion={c} t={t} />
            ))}
          </div>
        </Section>
      )}

      {spec.charts.length > 0 && (
        <Section title={t.dash.chartsTitle} subtitle={t.dash.chartsSub}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {spec.charts.map((c) => (
              <Chart key={c.id} spec={c} />
            ))}
          </div>
        </Section>
      )}

      {table && (
        <Section title={t.dash.askTitle} subtitle={t.dash.askSub}>
          <QueryBox table={table} profiles={spec.profiles} />
        </Section>
      )}

      {table && (
        <Section title={t.dash.buildTitle} subtitle={t.dash.buildSub}>
          <ChartBuilder table={table} profiles={spec.profiles} />
        </Section>
      )}

      {table && (
        <Section title={t.dash.browseTitle} subtitle={t.dash.browseSub}>
          <DataTable table={table} profiles={spec.profiles} />
        </Section>
      )}
    </div>
  );
}

function ConclusionCard({ conclusion, t }: { conclusion: Conclusion; t: AppDict }) {
  const conf = {
    style:
      conclusion.confidence === "high"
        ? "bg-emerald-500/15 text-emerald-300"
        : conclusion.confidence === "medium"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-slate-500/15 text-slate-300",
    label: t.conf[conclusion.confidence],
  };
  return (
    <div className="card card-hover flex gap-3 p-4">
      <div className="text-lg leading-none">💡</div>
      <div className="flex-1">
        <p className="text-sm leading-relaxed text-slate-200">{conclusion.text}</p>
        {conclusion.detail && (
          <p className="mt-1.5 text-xs leading-snug text-slate-500">
            <span className="text-slate-400">📊 {t.dash.theNumbers}</span> {conclusion.detail}
          </p>
        )}
        <div className="mt-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${conf.style}`}>{conf.label}</span>
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
