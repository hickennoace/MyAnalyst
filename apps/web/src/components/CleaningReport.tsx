"use client";

import { useState } from "react";
import type { CleaningReport as Report } from "@/lib/types";

export function CleaningReport({ report }: { report: Report }) {
  const [showPreview, setShowPreview] = useState(true);
  const removed = report.rowsBefore - report.rowsAfter;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Cleaning report</h3>
          <p className="text-xs text-slate-400">What we fixed before analyzing — so you can trust the numbers.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Stat label="rows in" value={report.rowsBefore.toLocaleString()} />
          <span className="text-slate-600">→</span>
          <Stat label="rows out" value={report.rowsAfter.toLocaleString()} tone="good" />
        </div>
      </div>

      {/* Summary chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip n={removed} label={`row${removed === 1 ? "" : "s"} removed`} tone={removed ? "warn" : "muted"} />
        <Chip n={report.duplicatesRemoved} label="duplicates" tone="warn" />
        <Chip n={report.totalRowsRemoved} label="total rows" tone="warn" />
        <Chip n={report.emptyRowsRemoved} label="empty rows" tone="warn" />
        <Chip n={report.cellsNormalized} label="cells normalized" tone="brand" />
        <Chip n={report.cellsTrimmed} label="cells trimmed" tone="brand" />
      </div>

      {/* Steps */}
      <ul className="mt-4 space-y-2">
        {report.steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 text-emerald-400">✓</span>
            <span>
              <span className="font-medium text-slate-200">{s.label}</span>
              {s.count > 0 && <span className="ml-1 text-indigo-300">({s.count.toLocaleString()})</span>}
              <span className="text-slate-500"> — {s.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* Per-column detection */}
      <details className="mt-4 text-xs">
        <summary className="cursor-pointer text-slate-300 hover:text-slate-100">Column types &amp; per-column changes</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-1 pr-4">Column</th>
                <th className="py-1 pr-4">Detected type</th>
                <th className="py-1 pr-4">Normalized</th>
                <th className="py-1 pr-4">Trimmed</th>
                <th className="py-1">Missing</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {report.columns.map((c) => (
                <tr key={c.name} className="border-t border-slate-800">
                  <td className="py-1 pr-4 font-medium text-slate-200">{c.name}</td>
                  <td className="py-1 pr-4">
                    <span className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] text-slate-300">{c.detectedType}</span>
                  </td>
                  <td className="py-1 pr-4">{c.cellsNormalized || "—"}</td>
                  <td className="py-1 pr-4">{c.trimmed || "—"}</td>
                  <td className="py-1">{c.missing || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Before / after preview */}
      {report.preview.rows.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-200">Before / after preview</h4>
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="text-[11px] text-indigo-300 hover:text-indigo-200"
            >
              {showPreview ? "Hide" : "Show"}
            </button>
          </div>
          {showPreview && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PreviewTable title="Raw" columns={report.preview.columns} rows={report.preview.rows.map((r) => r.before)} />
              <PreviewTable
                title="Cleaned"
                columns={report.preview.columns}
                rows={report.preview.rows.map((r) => r.after)}
                changed={report.preview.rows.map((r) => r.changed)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewTable({
  title,
  columns,
  rows,
  changed,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  changed?: boolean[][];
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">{title}</p>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-slate-900/60 text-slate-400">
            <tr>
              {columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-2 py-1.5 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t border-slate-800/70">
                {row.map((cell, ci) => {
                  const isChanged = changed?.[ri]?.[ci];
                  return (
                    <td
                      key={ci}
                      className={`whitespace-nowrap px-2 py-1.5 ${
                        isChanged ? "bg-emerald-500/10 font-medium text-emerald-300" : "text-slate-300"
                      }`}
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Chip({ n, label, tone }: { n: number; label: string; tone: "warn" | "brand" | "muted" }) {
  const cls =
    tone === "warn"
      ? "bg-amber-500/15 text-amber-300"
      : tone === "brand"
      ? "bg-indigo-500/15 text-indigo-300"
      : "bg-slate-700/30 text-slate-400";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      <span className="font-bold">{n.toLocaleString()}</span> {label}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" }) {
  return (
    <span className="rounded-lg border border-slate-700 px-2.5 py-1">
      <span className={`font-bold ${tone === "good" ? "text-emerald-300" : "text-slate-100"}`}>{value}</span>
      <span className="ml-1 text-slate-500">{label}</span>
    </span>
  );
}
