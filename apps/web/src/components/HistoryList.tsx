"use client";

import type { HistoryEntry } from "@/lib/history";

// Recent analyses, restored from localStorage. Lets the user reopen a past dashboard without
// re-uploading — fully local, nothing is sent anywhere.

export function HistoryList({
  entries,
  onOpen,
  onDelete,
}: {
  entries: HistoryEntry[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Recent analyses</h3>
        <span className="text-[11px] text-slate-500">stored locally on this device</span>
      </div>
      <ul className="divide-y divide-slate-800">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
            <button onClick={() => onOpen(e.id)} className="group min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-slate-200 group-hover:text-[#ff5740]">{e.name}</p>
              <p className="text-[11px] text-slate-500">
                {e.rowCount.toLocaleString()} rows · {e.colCount} cols · {e.domain} ·{" "}
                {new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpen(e.id)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800/60"
              >
                Open
              </button>
              <button
                onClick={() => onDelete(e.id)}
                title="Delete from history"
                aria-label={`Delete ${e.name} from history`}
                className="rounded-lg px-2 py-1.5 text-xs text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
