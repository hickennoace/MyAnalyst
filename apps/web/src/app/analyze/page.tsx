"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DashboardSpec, Table } from "@/lib/types";
import { parseFile } from "@/lib/parse";
import { analyze } from "@/lib/analyze";
import { cleanTable } from "@/lib/clean";
import { downloadCsv } from "@/lib/csv";
import { sampleTable } from "@/lib/sample";
import { exportPdf, exportPng } from "@/lib/export";
import { encodeSpec, MAX_LINK_CHARS } from "@/lib/share";
import { deleteAnalysis, getAnalysis, listHistory, saveAnalysis, type HistoryEntry } from "@/lib/history";
import { Uploader } from "@/components/Uploader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandMark";
import { DashboardView } from "@/components/DashboardView";
import { HistoryList } from "@/components/HistoryList";
import { PipelineProgress } from "@/components/PipelineProgress";

const CONTEXT_KEY = "quantia:context";

const STAGES = ["Reading file", "Cleaning & normalizing", "Profiling columns", "Detecting domain", "Computing KPIs", "Running statistics", "Writing insights"];

export default function AnalyzePage() {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [readInfo, setReadInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [spec, setSpec] = useState<DashboardSpec | null>(null);
  const [exporting, setExporting] = useState<null | "png" | "pdf">(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [jobDesc, setJobDesc] = useState("");
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(listHistory());
    // Work-context lives only in this browser (localStorage) — never sent anywhere.
    setJobDesc(localStorage.getItem(CONTEXT_KEY) ?? "");
  }, []);

  function updateContext(v: string) {
    setJobDesc(v);
    try {
      localStorage.setItem(CONTEXT_KEY, v);
    } catch {
      /* ignore quota */
    }
  }

  async function handleOpenHistory(id: string) {
    const loaded = await getAnalysis(id);
    if (!loaded) return;
    setError(null);
    setShareMsg(null);
    setTable(loaded.table);
    setSpec(loaded.spec);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  function handleDeleteHistory(id: string) {
    deleteAnalysis(id);
    setHistory(listHistory());
  }

  async function handleShare() {
    if (!spec) return;
    setShareMsg("Building link…");
    try {
      const payload = await encodeSpec(spec);
      const url = `${window.location.origin}/view#${payload}`;
      if (url.length > MAX_LINK_CHARS) {
        setShareMsg("Dataset too large for a link — use PNG/PDF export instead.");
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMsg(`🔗 Read-only link copied (${(url.length / 1024).toFixed(0)} KB) — paste it anywhere.`);
    } catch {
      setShareMsg("Couldn't create the link in this browser.");
    }
  }

  async function handleExport(kind: "png" | "pdf") {
    if (!dashboardRef.current || !spec || exporting) return;
    setExporting(kind);
    setError(null);
    try {
      const meta = `${spec.rowCount.toLocaleString()} rows · ${spec.profiles.length} columns · ${spec.domain.domain}`;
      if (kind === "png") await exportPng(dashboardRef.current, spec.datasetName, meta);
      else await exportPdf(dashboardRef.current, spec.datasetName, meta);
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
      // Kick off the real work immediately, then let the staged progress animation
      // play *concurrently* with it (instead of blocking before it). On large files
      // the compute dominates and the animation is free; on small files it still
      // reads as a quick, intentional pipeline.
      const work = analyze(tbl, { userContext: jobDesc });
      for (const s of STAGES) {
        setStage(s);
        await new Promise((r) => setTimeout(r, 60));
      }
      const result = await work;
      // Show & operate on the CLEANED data downstream (normalized values, deduped, total rows removed).
      const cleaned = cleanTable(tbl).table;
      // Carry the "this was a sample of a huge file" note through cleaning.
      if (tbl.sampledFrom) cleaned.sampledFrom = tbl.sampledFrom;
      setTable(cleaned);
      setSpec(result);
      try {
        await saveAnalysis(result, cleaned);
        setHistory(listHistory());
      } catch {
        /* history is best-effort; never block the dashboard on it */
      }
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
      setReadInfo(file.size > 24 * 1024 * 1024 ? `Reading ${(file.size / 1048576).toFixed(0)} MB…` : null);
      const tbl = await parseFile(file, (p) => {
        const pct = p.totalBytes ? Math.min(100, Math.round((p.bytes / p.totalBytes) * 100)) : 0;
        setReadInfo(`Read ${p.rows.toLocaleString()} rows · ${pct}%`);
      });
      setReadInfo(null);
      if (!tbl.columns.length || !tbl.rowCount) {
        throw new Error("No tabular data found. Make sure the first row contains column headers.");
      }
      await run(tbl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
      setBusy(false);
      setStage(null);
      setReadInfo(null);
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
    <main id="main-content" className="glow app-bg min-h-screen">
      <div className="app-aurora" aria-hidden>
        <span className="a1" /><span className="a2" /><span className="a3" />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-50">MyAnalyst</h1>
              <p className="text-xs text-slate-400">Analyzer</p>
            </div>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
          <ThemeToggle />
          {spec ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => table && downloadCsv(table, spec.datasetName)}
                className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60"
                title="Download the cleaned, normalized data as CSV"
              >
                ⬇ Data
              </button>
              <button
                onClick={handleShare}
                className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60"
                title="Copy a read-only link to this dashboard"
              >
                🔗 Share
              </button>
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
                className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-400"
              >
                New analysis
              </button>
            </div>
          ) : (
            <Link href="/" className="text-sm text-slate-400 transition hover:text-slate-200">
              ← Home
            </Link>
          )}
          </div>
        </header>

        {!spec && (
          <div className="space-y-4">
            <Uploader onFile={handleFile} onSample={() => run(sampleTable())} busy={busy} />
            {busy && stage && <PipelineProgress stages={STAGES} current={stage} detail={readInfo ?? undefined} />}
            {error && <div className="card border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-300">{error}</div>}

            <details className="card p-4 text-sm">
              <summary className="cursor-pointer font-medium text-slate-200">
                ✨ Add context <span className="font-normal text-slate-500">(optional) — tell us what this data is about</span>
              </summary>
              <p className="mt-2 text-xs text-slate-400">
                A line about your data or goal sharpens the analysis: it steers domain detection and the metrics
                we pick, and frames the “About this data” summary and insights around what you care about. Stored
                only in this browser — never uploaded anywhere.
              </p>
              <textarea
                value={jobDesc}
                onChange={(e) => updateContext(e.target.value)}
                rows={2}
                placeholder="e.g. I run a used-car dealership and want to understand why customers don't buy."
                className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
              />
            </details>

            <HistoryList entries={history} onOpen={handleOpenHistory} onDelete={handleDeleteHistory} />
          </div>
        )}

        {shareMsg && (
          <div className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm text-blue-200">
            {shareMsg}
          </div>
        )}

        {spec && table?.sampledFrom && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
            Large file detected — analyzed a representative random sample of{" "}
            <strong>{table.rowCount.toLocaleString()}</strong> rows out of{" "}
            <strong>{table.sampledFrom.toLocaleString()}</strong>. The statistics are valid for the full
            dataset; exact totals would need the complete file.
          </div>
        )}

        {spec && table && <DashboardView spec={spec} table={table} innerRef={dashboardRef} />}

        <footer className="mt-16 border-t border-slate-800 pt-6 text-center text-xs text-slate-600">
          MyAnalyst · Analysis runs locally in your browser. Insight narration is pluggable.
        </footer>
      </div>
    </main>
  );
}
