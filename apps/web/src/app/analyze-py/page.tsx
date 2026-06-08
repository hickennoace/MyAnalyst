"use client";

import { useState } from "react";
import Papa from "papaparse";
import { runPythonAnalysis, runPythonConclusions, type PyAnalysisSpec, type PyConclusions } from "@/lib/py-engine";
import { PythonDashboard } from "@/components/PythonDashboard";

// Isolated test page for the Python analysis backend (Phase 5). Deliberately separate from /analyze so the
// live TypeScript dashboard is untouched — visit /analyze-py to validate the Python engine end-to-end.

export default function AnalyzePyPage() {
  const [spec, setSpec] = useState<PyAnalysisSpec | null>(null);
  const [conclusions, setConclusions] = useState<PyConclusions | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    setSpec(null);
    setConclusions(null);
    setStatus(`Parsing ${file.name}…`);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: async (res) => {
        try {
          const rows = res.data;
          const columns = res.meta.fields ?? Object.keys(rows[0] ?? {});
          if (!rows.length || !columns.length) throw new Error("No rows found in the file.");
          setStatus(`Analyzing ${rows.length.toLocaleString()} rows with Python…`);
          const s = await runPythonAnalysis(columns, rows);
          setSpec(s);
          setStatus("Writing conclusions…");
          setConclusions(await runPythonConclusions(s).catch(() => null));
          setStatus("");
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("");
        }
      },
      error: (e) => {
        setError(e.message);
        setStatus("");
      },
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">MyAnalyst — Python engine (preview)</h1>
      <p className="mt-1 text-sm text-slate-400">
        Upload a CSV to analyze it with the Python (pandas/statsmodels) backend. This page is isolated from
        the live analyzer.
      </p>

      <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center transition hover:border-slate-500">
        <span className="text-sm font-medium text-slate-300">Choose a CSV file</span>
        <span className="mt-1 text-[12px] text-slate-500">parsed in your browser, then sent to /api/analyze</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>

      {status && <p className="mt-4 text-sm text-blue-300">{status}</p>}
      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {spec && (
        <div className="mt-8">
          <PythonDashboard spec={spec} conclusions={conclusions} />
        </div>
      )}
    </main>
  );
}
