"use client";

import { useMemo, useState } from "react";
import { llmEnabled } from "@/lib/insights/humanize";

// Privacy indicator: a small, honest "your data stays in your browser" badge. The whole analysis
// engine runs client-side; only metadata/aggregates ever reach the optional LLM route — never raw rows.
// The popover spells that out so the claim is verifiable, not just decorative.

export function PrivacyBadge() {
  const [open, setOpen] = useState(false);
  const ai = useMemo(() => llmEnabled(), []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-label="Privacy details"
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/15"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        Private
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-left shadow-xl backdrop-blur"
        >
          <p className="text-xs font-semibold text-slate-100">Your data stays in your browser</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            The whole analysis runs on this page — your file is never uploaded to a server. You can close
            your connection after it loads and everything still works.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            {ai
              ? "AI narration is on: only anonymous aggregates (totals, averages, column names) are sent to write the prose — never your raw rows."
              : "No AI key is configured, so nothing leaves this page at all."}
          </p>
        </div>
      )}
    </div>
  );
}
