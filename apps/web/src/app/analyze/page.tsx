"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DashboardSpec, SemanticType, Table } from "@/lib/types";
import { parseFile, type SourceInfo } from "@/lib/parse";
import { runAnalysis } from "@/lib/analyze-client";
import { downloadCsv } from "@/lib/csv";
import { sampleTable } from "@/lib/sample";
import { exportPdf, exportPng } from "@/lib/export";
import { encodeSpec, MAX_LINK_CHARS } from "@/lib/share";
import { deleteAnalysis, getAnalysis, listHistory, saveAnalysis, type HistoryEntry } from "@/lib/history";
import { compareDatasets, type DatasetComparison } from "@/lib/compare-datasets";
import { profileTable } from "@/lib/profile";
import { ComparisonCard } from "@/components/ComparisonCard";
import { Uploader } from "@/components/Uploader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandMark";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { DashboardView } from "@/components/DashboardView";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ColumnControls } from "@/components/ColumnControls";
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
  // The full parsed source (all columns) + the user's column choices, so "Apply & re-run" can
  // re-analyze from scratch with exclusions/type overrides applied.
  const [sourceTable, setSourceTable] = useState<Table | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [typeOverrides, setTypeOverrides] = useState<Record<string, SemanticType>>({});
  // Multi-sheet (Excel) / multi-table (SQLite) support: the uploaded file + its selectable sources.
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [fileSources, setFileSources] = useState<SourceInfo[]>([]);
  const [currentSourceId, setCurrentSourceId] = useState<string>("");
  const [sourceKind, setSourceKind] = useState<"sheet" | "table" | undefined>(undefined);
  const [joinId, setJoinId] = useState<string>("");
  const [exporting, setExporting] = useState<null | "png" | "pdf">(null);
  const [comparison, setComparison] = useState<DatasetComparison | null>(null);
  const [comparing, setComparing] = useState(false);
  const compareInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [jobDesc, setJobDesc] = useState("");
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listHistory().then(setHistory).catch(() => {});
    // Work-context lives only in this browser (localStorage) — never sent anywhere.
    setJobDesc(localStorage.getItem(CONTEXT_KEY) ?? "");
  }, []);

  // Transient toasts auto-dismiss; errors linger a little longer than info.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.tone === "error" ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [toast]);

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
    setToast(null);
    // Chart formatters don't survive JSON serialization, so rebuild the charts from the stored
    // table + profiles — same as the live path — so reopened dashboards look identical to fresh ones.
    try {
      const { recommendCharts } = await import("@/lib/charts");
      loaded.spec.charts = recommendCharts(loaded.table, loaded.spec.profiles);
    } catch {
      /* fall back to the stored (functionless) charts */
    }
    setTable(loaded.table);
    setSpec(loaded.spec);
    // Re-runnable from the loaded table; the stored spec already reflects its prior column choices.
    setSourceTable(loaded.table);
    setExcluded(new Set());
    setTypeOverrides({});
    // History entries have no underlying file, so there's no sheet/table picker.
    setSourceFile(null);
    setFileSources([]);
    setCurrentSourceId("");
    setSourceKind(undefined);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  async function handleDeleteHistory(id: string) {
    await deleteAnalysis(id);
    setHistory(await listHistory());
  }

  async function handleShare() {
    if (!spec) return;
    setToast({ text: "Building link…", tone: "info" });
    try {
      const payload = await encodeSpec(spec);
      const url = `${window.location.origin}/view#${payload}`;
      if (url.length > MAX_LINK_CHARS) {
        setToast({ text: "Dataset too large for a link — use PNG/PDF export instead.", tone: "error" });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast({ text: `🔗 Read-only link copied (${(url.length / 1024).toFixed(0)} KB) — paste it anywhere.`, tone: "info" });
    } catch {
      setToast({ text: "Couldn't create the link in this browser.", tone: "error" });
    }
  }

  // Compare the current dataset with a second uploaded file → ranked "what changed".
  async function handleCompare(file: File) {
    if (!table || comparing) return;
    setComparing(true);
    try {
      const result = await parseFile(file);
      if (!result.table.columns.length || !result.table.rowCount) throw new Error("That file has no usable data to compare.");
      setComparison(compareDatasets(table, result.table, spec?.profiles, profileTable(result.table)));
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : "Couldn't read that file.", tone: "error" });
    } finally {
      setComparing(false);
    }
  }

  async function handleExport(kind: "png" | "pdf") {
    if (!dashboardRef.current || !spec || exporting) return;
    setExporting(kind);
    setToast(null);
    try {
      const meta = `${spec.rowCount.toLocaleString()} rows · ${spec.profiles.length} columns · ${spec.domain.domain}`;
      if (kind === "png") await exportPng(dashboardRef.current, spec.datasetName, meta);
      else await exportPdf(dashboardRef.current, spec.datasetName, meta);
      setToast({ text: `✓ ${kind.toUpperCase()} downloaded.`, tone: "info" });
    } catch {
      // The export-error banner was previously routed to `error`, which only renders in the
      // pre-analysis (no-spec) view — so failures were silent. Surface it in the toast instead.
      setToast({ text: "Export failed — the dashboard may be too large. Try again or use PNG.", tone: "error" });
    } finally {
      setExporting(null);
    }
  }

  async function run(
    sourceTbl: Table,
    opts?: { excluded?: Set<string>; overrides?: Record<string, SemanticType> }
  ) {
    const excl = opts?.excluded ?? new Set<string>();
    const ov = opts?.overrides ?? {};
    setError(null);
    setBusy(true);
    // Fresh run (from upload/sample) returns to the uploader+progress view; a re-run from the
    // column controls keeps the current dashboard on screen (dimmed) so it doesn't flash away.
    if (!opts) setSpec(null);
    setSourceTable(sourceTbl);
    try {
      // Apply column exclusions (the pipeline reads `columns`, so filtering it is enough — rows can
      // keep the extra keys, they're ignored). Type overrides flow into cleaning via runAnalysis.
      const analyzedTbl = excl.size
        ? { ...sourceTbl, columns: sourceTbl.columns.filter((c) => !excl.has(c)) }
        : sourceTbl;
      // The whole pipeline (clean → profile → stats → charts → insights) runs in a Web Worker,
      // so the UI never freezes even on a 200k-row file — and the progress here reflects the
      // worker's REAL stage transitions instead of a timed animation.
      setStage("Cleaning & normalizing");
      const { spec: result, table: cleaned } = await runAnalysis(analyzedTbl, jobDesc, (s) => setStage(s), ov);
      setTable(cleaned);
      setSpec(result);
      setExcluded(excl);
      setTypeOverrides(ov);
      try {
        await saveAnalysis(result, cleaned);
        setHistory(await listHistory());
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

  function handleApplyColumns(nextExcluded: Set<string>, nextOverrides: Record<string, SemanticType>) {
    if (!sourceTable) return;
    run(sourceTable, { excluded: nextExcluded, overrides: nextOverrides });
  }

  async function handleFile(file: File) {
    try {
      setBusy(true);
      setStage("Reading file");
      setReadInfo(file.size > 24 * 1024 * 1024 ? `Reading ${(file.size / 1048576).toFixed(0)} MB…` : null);
      const result = await parseFile(file, (p) => {
        const pct = p.totalBytes ? Math.min(100, Math.round((p.bytes / p.totalBytes) * 100)) : 0;
        setReadInfo(`Read ${p.rows.toLocaleString()} rows · ${pct}%`);
      });
      setReadInfo(null);
      if (!result.table.columns.length || !result.table.rowCount) {
        throw new Error("No tabular data found. Make sure the first row contains column headers.");
      }
      // Remember the file + its sheets/tables so the user can switch between them later.
      setSourceFile(file);
      setFileSources(result.sources);
      setCurrentSourceId(result.sourceId);
      setSourceKind(result.sourceKind);
      await run(result.table);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
      setBusy(false);
      setStage(null);
      setReadInfo(null);
    }
  }

  // Re-parse a different sheet/table from the same file and analyze it.
  async function handleSelectSource(id: string) {
    if (!sourceFile || id === currentSourceId || busy) return;
    setError(null);
    setBusy(true);
    setStage("Reading file");
    try {
      const result = await parseFile(sourceFile, undefined, id);
      if (!result.table.columns.length || !result.table.rowCount) {
        throw new Error("That selection has no usable tabular data.");
      }
      setCurrentSourceId(id);
      setSourceKind(result.sourceKind);
      await run(result.table); // resets column choices and manages busy/stage
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that selection.");
      setBusy(false);
      setStage(null);
    }
  }

  // Enrich the current table by joining another table/sheet from the same file on an auto-detected key.
  async function handleJoin() {
    if (!sourceFile || !sourceTable || !joinId || busy) return;
    setError(null);
    setBusy(true);
    setStage("Reading file");
    try {
      const result = await parseFile(sourceFile, undefined, joinId);
      const right = result.table;
      if (!right.columns.length || !right.rowCount) throw new Error("That table has no usable data to join.");
      const { suggestJoinKeys, joinTables } = await import("@/lib/join");
      const keys = suggestJoinKeys(sourceTable, right);
      if (!keys.length) {
        throw new Error(`No shared key found between “${sourceTable.name}” and “${right.name}”. Tables need a common column (e.g. an id) to join.`);
      }
      const k = keys[0];
      const joined = joinTables(sourceTable, right, k.leftKey, k.rightKey, "left");
      // The result is a new combined dataset — clear the single-source picker to avoid confusion.
      setFileSources([]);
      setCurrentSourceId("");
      setSourceKind(undefined);
      setJoinId("");
      setToast({ text: `Joined on ${k.leftKey} = ${k.rightKey} · ${joined.rowCount.toLocaleString()} rows`, tone: "info" });
      await run(joined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join those tables.");
      setBusy(false);
      setStage(null);
    }
  }

  function startSample() {
    // Samples have no underlying file/sheets — clear any picker state from a prior upload.
    setSourceFile(null);
    setFileSources([]);
    setCurrentSourceId("");
    setSourceKind(undefined);
    run(sampleTable());
  }

  // Auto-run the sample when arriving from the landing page's "Try a sample" CTA (/analyze?demo=1).
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1") {
      startSample();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    setSpec(null);
    setTable(null);
    setError(null);
    setSourceTable(null);
    setExcluded(new Set());
    setTypeOverrides({});
    setSourceFile(null);
    setFileSources([]);
    setCurrentSourceId("");
    setSourceKind(undefined);
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
          <PrivacyBadge />
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
                onClick={() => compareInputRef.current?.click()}
                disabled={comparing}
                className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-50"
                title="Compare this dataset with another file (this month vs last, store A vs B…)"
              >
                {comparing ? "Comparing…" : "⇄ Compare"}
              </button>
              <input
                ref={compareInputRef}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls,.json,.sqlite,.sqlite3,.db,.db3"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCompare(f);
                  e.target.value = "";
                }}
              />
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
            <Uploader onFile={handleFile} onSample={startSample} busy={busy} />
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

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`fade-up mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm ${
              toast.tone === "error"
                ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                : "border-blue-500/30 bg-blue-500/10 text-blue-200"
            }`}
          >
            <span>{toast.text}</span>
            <button
              onClick={() => setToast(null)}
              aria-label="Dismiss"
              className="-mr-1 shrink-0 rounded-md px-1.5 leading-none opacity-60 transition hover:opacity-100"
            >
              ✕
            </button>
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

        {spec && busy && stage && (
          <div className="mb-4">
            <PipelineProgress stages={STAGES} current={stage} detail="Re-analyzing…" />
          </div>
        )}

        {spec && fileSources.length > 1 && (
          <div className="mb-4 card flex flex-wrap items-center gap-2 p-3 text-sm">
            <span className="font-medium text-slate-300">{sourceKind === "table" ? "Table" : "Sheet"}:</span>
            <select
              value={currentSourceId}
              onChange={(e) => handleSelectSource(e.target.value)}
              disabled={busy}
              aria-label={`Choose which ${sourceKind === "table" ? "table" : "sheet"} to analyze`}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-100 focus:border-blue-400 focus:outline-none disabled:opacity-50"
            >
              {fileSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.rowCount.toLocaleString()} rows)
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              {fileSources.length} {sourceKind === "table" ? "tables" : "sheets"} in this file
            </span>

            {/* Join the current table with another from the same file (auto-detected key). */}
            <span className="ml-1 border-l border-slate-700 pl-3 font-medium text-slate-300">Join with:</span>
            <select
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              disabled={busy}
              aria-label="Choose a table to join with the current one"
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-100 focus:border-blue-400 focus:outline-none disabled:opacity-50"
            >
              <option value="">{sourceKind === "table" ? "another table…" : "another sheet…"}</option>
              {fileSources
                .filter((s) => s.id !== currentSourceId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
            </select>
            <button
              onClick={handleJoin}
              disabled={busy || !joinId}
              className="rounded-lg bg-blue-500/90 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-400 disabled:opacity-50"
            >
              Join
            </button>
          </div>
        )}

        {spec && sourceTable && (
          <div className="mb-4">
            <ColumnControls
              profiles={spec.profiles}
              allColumns={sourceTable.columns}
              excluded={excluded}
              overrides={typeOverrides}
              busy={busy}
              onApply={handleApplyColumns}
            />
          </div>
        )}

        {comparison && (
          <div className="mb-6">
            <ComparisonCard comparison={comparison} onClose={() => setComparison(null)} />
          </div>
        )}

        {spec && table && (
          <ErrorBoundary label="dashboard">
            <div className={busy ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"}>
              <DashboardView spec={spec} table={table} innerRef={dashboardRef} />
            </div>
          </ErrorBoundary>
        )}

        <footer className="mt-16 border-t border-slate-800 pt-6 text-center text-xs text-slate-600">
          MyAnalyst · Analysis runs locally in your browser. Insight narration is pluggable.
        </footer>
      </div>
    </main>
  );
}
