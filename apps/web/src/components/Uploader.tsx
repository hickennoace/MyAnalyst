"use client";

import { useCallback, useRef, useState } from "react";

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
        CSV, TSV, Excel, or JSON. Everything runs in your browser — your data never leaves this page.
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

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.xlsx,.xls,.json"
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
