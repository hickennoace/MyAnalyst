"use client";

import { useCallback, useRef, useState } from "react";
import { fetchAsFile } from "@/lib/url-import";

export function Uploader({
  onFile,
  onSample,
  busy,
}: {
  onFile: (file: File) => void;
  onSample: () => void;
  busy: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlErr, setUrlErr] = useState<string | null>(null);

  const loadUrl = useCallback(async () => {
    const u = url.trim();
    if (!u || busy || urlLoading) return;
    setUrlErr(null);
    setUrlLoading(true);
    try {
      const file = await fetchAsFile(u);
      onFile(file);
    } catch (e) {
      setUrlErr(e instanceof Error ? e.message : "Couldn't load that URL.");
    } finally {
      setUrlLoading(false);
    }
  }, [url, busy, urlLoading, onFile]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      className={`card flex flex-col items-center justify-center px-8 py-16 text-center transition-all duration-300 ${
        drag ? "scale-[1.01] border-blue-400 bg-blue-500/10 shadow-[0_0_50px_-12px_rgba(61,139,255,0.55)]" : ""
      }`}
    >
      <div className="mb-4 animate-float">
        <div
          className={`grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/15 text-blue-300 transition-transform duration-300 ${drag ? "scale-110" : ""}`}
          style={{ animation: "stepPulse 2.6s ease-in-out infinite" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
            <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
          </svg>
        </div>
      </div>
      <h2 className="text-lg font-semibold text-slate-100">Drop a spreadsheet to analyze</h2>
      <p className="mt-1 max-w-md text-sm text-slate-400">
        CSV, TSV, Excel, JSON, or SQLite. Big CSVs stream up to ~1&nbsp;GB — analyzed on a representative
        sample. Everything runs in your browser; your data never leaves this page.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-shine rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:opacity-50"
        >
          {busy ? "Analyzing…" : "Choose file"}
        </button>
        <button
          onClick={onSample}
          disabled={busy}
          className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-50"
        >
          Try a sample dataset
        </button>
      </div>

      {/* Or load from a public URL — reuses the same parser; data is fetched straight to your browser. */}
      <div className="mt-5 w-full max-w-md">
        <div className="flex items-center gap-2">
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadUrl()}
            placeholder="…or paste a public CSV URL"
            aria-label="Public CSV URL"
            disabled={busy || urlLoading}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900/60 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none disabled:opacity-60"
          />
          <button
            onClick={loadUrl}
            disabled={busy || urlLoading || !url.trim()}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-50"
          >
            {urlLoading ? "Loading…" : "Load"}
          </button>
        </div>
        {urlErr && <p className="mt-2 text-left text-xs text-rose-300">{urlErr}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xls,.json,.sqlite,.sqlite3,.db,.db3"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
