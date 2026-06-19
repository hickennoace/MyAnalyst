"use client";

import { downloadRows } from "@/lib/csv";

// A small "export this segment as a worklist" button. Builds a CSV from the given columns + rows and
// downloads it client-side (no upload - same privacy posture as the rest of the app). Rendered only
// where the raw table is available (the live analyzer), so shared read-only views never leak row ids.

export function DownloadCsvButton({
  columns,
  rows,
  filename,
  label,
}: {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  filename: string;
  label?: string;
}) {
  if (!rows.length) return null;
  return (
    <button
      type="button"
      onClick={() => downloadRows(columns, rows, filename)}
      className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 transition hover:bg-slate-800"
      title={`Download ${rows.length.toLocaleString()} rows as CSV`}
    >
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10" />
      </svg>
      {label ?? `Download ${rows.length.toLocaleString()} as CSV`}
    </button>
  );
}
