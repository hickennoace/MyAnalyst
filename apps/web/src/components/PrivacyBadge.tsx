"use client";

import { useState } from "react";

// Privacy indicator: a small, HONEST badge. The compute engine now runs on a server (the Python
// backend), so the file is sent there over HTTPS to produce your dashboard — but it isn't stored, and
// only computed numbers/aggregates (never raw rows) ever reach the AI narrator. The popover spells the
// real flow out so the claim is verifiable, not decorative.

export function PrivacyBadge() {
  const [open, setOpen] = useState(false);

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
          <p className="text-xs font-semibold text-slate-100">Built to keep your data private</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Your file is sent over an encrypted connection to MyAnalyst&apos;s analysis server only to compute
            your dashboard. It isn&apos;t saved to any database, and it&apos;s never sold, shared, or used to
            train anything. No accounts, no third-party trackers.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            The AI narrator only ever receives computed numbers and column names (totals, averages,
            correlations) — never your raw rows. History and shareable links stay in your browser.
          </p>
        </div>
      )}
    </div>
  );
}
