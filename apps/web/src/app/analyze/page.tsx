"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DashboardSpec, Table } from "@/lib/types";
import { parseFile } from "@/lib/parse";
import { analyze } from "@/lib/analyze";
import { sampleTable } from "@/lib/sample";
import { exportPdf, exportPng } from "@/lib/export";
import { Uploader } from "@/components/Uploader";
import { KpiCard } from "@/components/KpiCard";
import { Chart } from "@/components/Chart";
import { InsightCard } from "@/components/InsightCard";
import { ChartBuilder } from "@/components/ChartBuilder";
import { CleaningReport } from "@/components/CleaningReport";

const STAGES = ["Reading file", "Cleaning & normalizing", "Profiling columns", "Detecting domain", "Computing KPIs", "Running statistics", "Writing insights"];

export default function AnalyzePage() {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [spec, setSpec] = useState<DashboardSpec | null>(null);
  const [exporting, setExporting] = useState<null | "png" | "pdf">(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  async function handleExport(kind: "png" | "pdf") {
    if (!dashboardRef.current || !spec || exporting) return;
    setExporting(kind);
    setError(null);
    try {
      if (kind === "png") await exportPng(dashboardRef.current, spec.datasetName);
      else await exportPdf(dashboardRef.current, spec.datasetName);
    } catch {
      setError("Export failed — the dashboard may be too large. Try again or use PNG.");
    } finally {
      setExporting(null);
    }
  }

  async function run(tbl: Table) {
    setError(null);
    setBusy(true);
    setSpec(null);
    try {
      for (const s of STAGES) {
        setStage(s);
        await new Promise((r) => setTimeout(r, 110));
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

  // Auto-run the sample when arriving from the landing page's "Try a sample" CTA (/analyze?demo=1).
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1") {
      run(sampleTable());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    setSpec(null);
    setTable(null);
    setError(null);
  }

  return (
    <main className="glow min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-black text-white">
              Q
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-50">Quantia</h1>
              <p className="text-xs text-slate-400">Analyzer</p>
            </div>
          </Link>
          {spec ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport("png")}
                disabled={!!exporting}
                className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-50"
                title="Download the dashboard as a PNG image"
              >
                {exporting === "png" ? "Exporting…" : "⬇ PNG"}
              </button>
              <button
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
                className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-50"
                title="Download the dashboard as a PDF"
              >
                {exporting === "pdf" ? "Exporting…" : "⬇ PDF"}
              </button>
              <button
                onClick={reset}
                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
              >
                New analysis
              </button>
            </div>
          ) : (
            <Link href="/" className="text-sm text-slate-400 transition hover:text-slate-200">
              ← Home
            </Link>
          )}
        </header>

        {!spec && (
          <div className="space-y-4">
            <Uploader onFile={handleFile} onSample={() => run(sampleTable())} busy={busy} />
            {busy && stage && (
              <div className="card flex items-center gap-3 p-4">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                <span className="text-sm text-slate-300">{stage}…</span>
              </div>
            )}
            {error && <div className="card border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-300">{error}</div>}
          </div>
        )}

        {spec && table && (
          <div className="space-y-8" ref={dashboardRef}>
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
              <Section title="What the data is telling you" subtitle="Plain-language conclusions, grounded in the computed numbers.">
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

            <Section title="Build your own" subtitle="Ask for any chart you want — in plain English or by picking columns.">
              <ChartBuilder table={table} profiles={spec.profiles} />
            </Section>
          </div>
        )}

        <footer className="mt-16 border-t border-slate-800 pt-6 text-center text-xs text-slate-600">
          Quantia · Analysis runs locally in your browser. Insight narration is pluggable.
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
