import type { Ref } from "react";
import type { DashboardSpec, Table } from "@/lib/types";
import { KpiCard } from "./KpiCard";
import { CaveatStrip } from "./CaveatStrip";
import { caveatForKpi } from "@/lib/caveats";
import { Chart } from "./Chart";
import { InsightCard } from "./InsightCard";
import { ChartBuilder } from "./ChartBuilder";
import { CleaningReport } from "./CleaningReport";
import { QualityCard } from "./QualityCard";
import { AnomalyCard } from "./AnomalyCard";
import { TimeTrendCard } from "./TimeTrendCard";
import { ContributionCard } from "./ContributionCard";
import { ThemesCard } from "./ThemesCard";
import { SegmentCard } from "./SegmentCard";
import { DriverCard } from "./DriverCard";
import { ScenarioCard } from "./ScenarioCard";
import { CohortCard } from "./CohortCard";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { ActionPlanCard } from "./ActionPlanCard";
import { domainFocus } from "@/lib/domain-pack";
import { QueryBox } from "./QueryBox";
import { DataTable } from "./DataTable";
import { Disclaimer } from "./Disclaimer";
import { MethodologyCard } from "./MethodologyCard";

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
    <div className="space-y-8 stagger-children" ref={innerRef}>
      <div className="card card-hover flex flex-wrap items-center justify-between gap-3 p-4">
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

      <CaveatStrip caveats={spec.caveats} smallSample={spec.smallSample} />

      <ExecutiveSummary spec={spec} />

      {spec.actions && spec.actions.length > 0 && (
        <Section title="Your action plan" subtitle="What to do next — ranked by impact, grounded in the numbers. The report a consultant would hand you.">
          <ActionPlanCard actions={spec.actions} />
        </Section>
      )}

      {spec.story && (
        <div className="card card-hover flex gap-3 p-5">
          <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">About this data</h3>
              <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
                {spec.story.industry}
              </span>
              {spec.story.source === "llm" && (
                <span className="rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                  ✨ AI-sharpened
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{spec.story.summary}</p>
          </div>
        </div>
      )}

      {spec.quality && (
        <Section title="Data quality" subtitle="An at-a-glance health check — what's solid and what to fix before you trust the numbers.">
          <QualityCard quality={spec.quality} />
        </Section>
      )}

      <Section title="Cleaning &amp; normalization" subtitle="The unglamorous core that makes everything below trustworthy.">
        <CleaningReport report={spec.cleaning} />
      </Section>

      <Section title="Key metrics" subtitle="Auto-selected for this dataset's shape and domain.">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {spec.kpis.slice(0, 8).map((kpi, i) => (
            <KpiCard key={kpi.id} kpi={kpi} index={i} caveat={spec.caveats ? caveatForKpi(kpi, spec.caveats) : undefined} />
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
            {spec.insights.map((ins, i) => (
              <InsightCard key={ins.id} insight={ins} index={i} />
            ))}
          </div>
        </Section>
      )}

      {spec.timeAnalysis && spec.timeAnalysis.length > 0 && (
        <Section title="Trends over time" subtitle="Period-over-period change with a moving-average trend line.">
          <TimeTrendCard analyses={spec.timeAnalysis} profiles={spec.profiles} />
        </Section>
      )}

      {spec.contributions && spec.contributions.length > 0 && (
        <Section title="What drove the change" subtitle="The latest period's move in the primary metric, attributed to the segments behind it — contributions sum to the total.">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {spec.contributions.map((c) => (
              <ContributionCard key={`${c.metric}-${c.dimension}`} analysis={c} profiles={spec.profiles} />
            ))}
          </div>
        </Section>
      )}

      {spec.drivers && spec.drivers.drivers.length > 0 && (
        <Section title="What moves the needle" subtitle={`The factors that most influence ${spec.drivers.target}, each holding the others constant.`}>
          <DriverCard drivers={spec.drivers} />
        </Section>
      )}

      {spec.drivers?.model && spec.drivers.model.predictors.length > 0 && (
        <Section title="Scenario simulator" subtitle="Drag the factors to project the outcome, or set a target and see which levers reach it — modelled, not guaranteed." exclude>
          <ScenarioCard drivers={spec.drivers} profiles={spec.profiles} />
        </Section>
      )}

      {spec.cohorts && spec.cohorts.cohorts.length > 1 && (
        <Section title="Cohort retention" subtitle="How well each cohort sticks around over time — the heartbeat of recurring-revenue data.">
          <CohortCard cohorts={spec.cohorts} />
        </Section>
      )}

      {spec.segmentation && spec.segmentation.segments.length > 1 && (
        <Section title="Natural segments" subtitle="Groups the data falls into on its own — and what defines each.">
          <SegmentCard segmentation={spec.segmentation} profiles={spec.profiles} />
        </Section>
      )}

      {spec.textAnalysis && spec.textAnalysis.length > 0 && (
        <Section title="Themes &amp; sentiment" subtitle="What people actually wrote — the recurring topics in your open-text responses, with sentiment and real quotes.">
          <ThemesCard analyses={spec.textAnalysis} />
        </Section>
      )}

      {spec.anomalies && spec.anomalies.length > 0 && (
        <Section title="Anomalies &amp; outliers" subtitle="Unusual values that can skew averages — flagged so you can verify or exclude them.">
          <AnomalyCard anomalies={spec.anomalies} profiles={spec.profiles} />
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

      <Section title="How this was computed" subtitle="Methods, assumptions, and limitations — plus a reproducible recipe. The transparency a consultant report carries.">
        <MethodologyCard spec={spec} />
      </Section>

      <Disclaimer />

      {table && (
        <Section title="Ask your data" subtitle={`${domainFocus(spec.domain.domain)} Ask in plain English — grounded in your real numbers.`} exclude>
          <QueryBox
            table={table}
            profiles={spec.profiles}
            domain={spec.domain.domain}
            analysis={{
              actions: spec.actions?.slice(0, 5).map((a) => ({ title: a.title, impact: a.impact })),
              drivers: spec.drivers
                ? { target: spec.drivers.target, r2Pct: Math.round(spec.drivers.r2 * 100), factors: spec.drivers.drivers.slice(0, 4).map((d) => ({ name: d.name, beta: Math.round(d.beta * 100) / 100, significant: d.significant })) }
                : undefined,
              trends: spec.timeAnalysis?.slice(0, 3).map((t) => ({ metric: t.metric, changePct: t.changePct ?? null })),
            }}
          />
        </Section>
      )}

      {table && (
        <Section title="Build your own" subtitle="Ask for any chart you want — in plain English or by picking columns." exclude>
          <ChartBuilder table={table} profiles={spec.profiles} />
        </Section>
      )}

      {table && (
        <Section title="Browse the data" subtitle="Search, sort, and page through every row." exclude>
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
  exclude,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  exclude?: boolean;
  children: React.ReactNode;
}) {
  // `exclude` marks interactive sections (Ask / Build / Browse) so PNG & PDF export
  // skip them — a static report shouldn't carry a half-typed query box or a giant table.
  return (
    <section {...(exclude ? { "data-export-exclude": "" } : {})}>
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
