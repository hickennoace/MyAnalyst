"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnProfile, SemanticType } from "@/lib/types";

// Lets the user steer the analysis BEFORE re-running it: drop columns that are noise, or correct a
// mis-detected type (e.g. an ID read as a number, or a number stored as text). Choices are applied
// by re-running the pipeline — exclusions filter the columns, type overrides flow into cleaning.

const TYPES: SemanticType[] = [
  "number", "currency", "percent", "integer", "date", "boolean", "category", "id", "text",
];

interface Props {
  /** Profiles from the current analysis (included columns only). */
  profiles: ColumnProfile[];
  /** Every column in the source file, including currently-excluded ones. */
  allColumns: string[];
  excluded: Set<string>;
  overrides: Record<string, SemanticType>;
  busy: boolean;
  onApply: (excluded: Set<string>, overrides: Record<string, SemanticType>) => void;
}

export function ColumnControls({ profiles, allColumns, excluded, overrides, busy, onApply }: Props) {
  // Re-sync the editable draft whenever the APPLIED state changes (a re-run finished, or a new file).
  const sig = useMemo(
    () => JSON.stringify([allColumns, [...excluded].sort(), overrides]),
    [allColumns, excluded, overrides]
  );
  const [draftExcluded, setDraftExcluded] = useState<Set<string>>(() => new Set(excluded));
  const [draftTypes, setDraftTypes] = useState<Record<string, SemanticType>>(() => ({ ...overrides }));
  useEffect(() => {
    setDraftExcluded(new Set(excluded));
    setDraftTypes({ ...overrides });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const detected = useMemo(() => {
    const m: Record<string, SemanticType> = {};
    for (const p of profiles) m[p.name] = p.type;
    return m;
  }, [profiles]);
  const roleOf = useMemo(() => {
    const m: Record<string, ColumnProfile["role"]> = {};
    for (const p of profiles) m[p.name] = p.role;
    return m;
  }, [profiles]);

  function toggle(col: string) {
    setDraftExcluded((s) => {
      const n = new Set(s);
      if (n.has(col)) n.delete(col);
      else n.add(col);
      return n;
    });
  }
  function setType(col: string, t: SemanticType) {
    setDraftTypes((m) => {
      const n = { ...m };
      if (t === detected[col]) delete n[col]; // back to auto-detected → no override needed
      else n[col] = t;
      return n;
    });
  }

  const includedCount = allColumns.length - draftExcluded.size;
  const tooFew = includedCount < 1;

  const dirty = useMemo(() => {
    if (draftExcluded.size !== excluded.size) return true;
    for (const c of draftExcluded) if (!excluded.has(c)) return true;
    const dk = Object.keys(draftTypes);
    const ok = Object.keys(overrides);
    if (dk.length !== ok.length) return true;
    for (const k of dk) if (draftTypes[k] !== overrides[k]) return true;
    return false;
  }, [draftExcluded, draftTypes, excluded, overrides]);

  function apply() {
    if (!dirty || tooFew || busy) return;
    onApply(new Set(draftExcluded), { ...draftTypes });
  }
  function resetDraft() {
    setDraftExcluded(new Set(excluded));
    setDraftTypes({ ...overrides });
  }

  return (
    <details className="card p-4 text-sm">
      <summary className="cursor-pointer font-medium text-slate-200">
        ⚙️ Columns{" "}
        <span className="font-normal text-slate-500">
          — exclude columns or fix a mis-detected type, then re-run
        </span>
      </summary>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {allColumns.map((col) => {
          const isExcluded = draftExcluded.has(col);
          const changed = draftTypes[col] !== undefined;
          return (
            <div
              key={col}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
                isExcluded ? "border-slate-800 bg-slate-900/30 opacity-60" : "border-slate-700 bg-slate-900/40"
              }`}
            >
              <input
                type="checkbox"
                checked={!isExcluded}
                onChange={() => toggle(col)}
                aria-label={`Include column ${col}`}
                className="h-4 w-4 shrink-0 accent-blue-500"
              />
              <span className="min-w-0 flex-1 truncate text-slate-200" title={col}>
                {col}
                {roleOf[col] && !isExcluded && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-500">{roleOf[col]}</span>
                )}
              </span>
              {isExcluded ? (
                <span className="shrink-0 text-[11px] text-slate-500">excluded</span>
              ) : (
                <select
                  value={draftTypes[col] ?? detected[col] ?? "text"}
                  onChange={(e) => setType(col, e.target.value as SemanticType)}
                  aria-label={`Type for column ${col}`}
                  className={`shrink-0 rounded-md border bg-slate-900/60 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none ${
                    changed ? "border-blue-500/60 text-blue-200" : "border-slate-700 text-slate-300"
                  }`}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs ${tooFew ? "text-rose-300" : "text-slate-500"}`}>
          {tooFew ? "Keep at least one column." : `${includedCount} of ${allColumns.length} columns included`}
        </span>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={resetDraft}
              disabled={busy}
              className="rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition hover:text-slate-200 disabled:opacity-50"
            >
              Reset
            </button>
          )}
          <button
            onClick={apply}
            disabled={!dirty || tooFew || busy}
            className="rounded-lg bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Re-running…" : "Apply & re-run"}
          </button>
        </div>
      </div>
    </details>
  );
}
