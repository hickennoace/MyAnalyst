"use client";

import { useState } from "react";
import type { DashboardSpec, Table } from "@/lib/types";
import { parseFile } from "@/lib/parse";
import { analyze } from "@/lib/analyze";
import { sampleTable } from "@/lib/sample";
import { Uploader } from "@/components/Uploader";
import { KpiCard } from "@/components/KpiCard";
import { Chart } from "@/components/Chart";
import { InsightCard } from "@/components/InsightCard";
import { ChartBuilder } from "@/components/ChartBuilder";
import { CleaningReport } from "@/components/CleaningReport";

const STAGES = ["Reading file", "Profiling columns", "Detecting domain", "Computing KPIs", "Running statistics", "Writing insights"];

export default function Home() {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [spec, setSpec] = useState<DashboardSpec | null>(null);

  async function run(tbl: Table) {
    setError(null);
    setBusy(true);
    setSpec(null);
    try {
      // Light staged feedback so the user watches the pipeline run.
      for (const s of STAGES) {
        setStage(s);
        await new Promise((r) => setTimeout(r, 120));
      }
      const result = await analyze(tbl);
      setTable(tbl);
      setSpec(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong analyzing that file.");
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  async function handleFile(file: File) {
    try {
      setBusy(true);
      setStage("Reading file");
      const tbl = await parseFile(file);
      if (!tbl.columns.length || !tbl.rowCount) {
        throw new Error("No tabular data found. Make sure the first row contains column headers.");
      }
      await run(tbl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
      setBusy(false);
      setStage(null);
    }
  }

  function reset() {
    setSpec(null);
    setTable(null);
    setError(null);
  }

  return (
    <main className="glow min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-black text-white">
              Q
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-50">Quantia</h1>
              <p className="text-xs text-slate-400">AI-assisted data analysis — instant dashboards from any spreadsheet</p>
            </div>
          </div>
          {spec && (
            <button
              onClick={reset}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60"
            >
              New analysis
            </button>
          )}
        </header>

        {/* Upload / progress */}
        {!spec && (
          <div className="space-y-4">
            <Uploader onFile={handleFile} onSample={() => run(sampleTable())} busy={busy} />
            {busy && stage && (
              <div className="card flex items-center gap-3 p-4">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                <span className="text-sm text-slate-300">{stage}…</span>
              </div>
            )}
            {error && (
              <div className="card border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-300">{error}</div>
            )}
          </div>
        )}

        {/* Dashboard */}
        {spec && table && (
          <div className="space-y-8">
            {/* Dataset + domain banner */}
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

            {/* Cleaning report + before/after preview */}
            <Section title="Cleaning &amp; normalization" subtitle="The unglamorous core that makes everything below trustworthy.">
              <CleaningReport report={spec.cleaning} />
            </Section>

            {/* KPIs */}
            <Section title="Key metrics" subtitle="Auto-selected for this dataset's shape and domain.">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {spec.kpis.slice(0, 8).map((kpi) => (
                  <KpiCard key={kpi.id} kpi={kpi} />
                ))}
              </div>
            </Section>

            {/* Insights */}
            {spec.insights.length > 0 && (
              <Section title="What the data is telling you" subtitle="Plain-language conclusions, grounded in the computed numbers.">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {spec.insights.map((ins) => (
                    <InsightCard key={ins.id} insight={ins} />
                  ))}
                </div>
              </Section>
            )}

            {/* Auto charts */}
            {spec.charts.length > 0 && (
              <Section title="Automatic charts" subtitle="The engine picked these from your data shape.">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {spec.charts.map((c) => (
                    <Chart key={c.id} spec={c} />
                  ))}
                </div>
              </Section>
            )}

            {/* On-demand chart builder */}
            <Section title="Build your own" subtitle="Ask for any chart you want — in plain English or by picking columns.">
              <ChartBuilder table={table} profiles={spec.profiles} />
            </Section>
          </div>
        )}

        <footer className="mt-16 border-t border-slate-800 pt-6 text-center text-xs text-slate-600">
          Quantia · Algorithmic analysis runs locally in your browser. Insight narration is pluggable —
          swap in an LLM later without changing the UI.
        </footer>
      </div>
    </main>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
