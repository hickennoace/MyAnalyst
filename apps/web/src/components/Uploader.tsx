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
      className={`card flex flex-col items-center justify-center px-8 py-16 text-center transition ${
        drag ? "border-indigo-400 bg-indigo-500/5" : ""
      }`}
    >
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-500/15 text-2xl">📊</div>
      <h2 className="text-lg font-semibold text-slate-100">Drop a spreadsheet to analyze</h2>
      <p className="mt-1 max-w-md text-sm text-slate-400">
        CSV, TSV, Excel, or JSON. Everything runs in your browser — your data never leaves this page.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:opacity-50"
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
