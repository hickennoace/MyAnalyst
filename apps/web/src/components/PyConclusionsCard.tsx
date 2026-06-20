"use client";

import { useState } from "react";
import type { PyConclusions } from "@/lib/py-engine";

// The AI (Groq) conclusions panel: reads the computed KPIs + charts and explains them in plain language.
// Shown at the top of the Overview tab so every upload opens with a decision-first, anyone-can-read summary.
// Built to be scannable: a headline "bottom line", a short summary, numbered findings, what each chart
// means, and ranked next steps - with a copy button and hover affordances (both export-safe).

export function PyConclusionsCard({ c }: { c: PyConclusions }) {
  const [copied, setCopied] = useState(false);
  const grounded = c.grounding?.grounded === true;
  // Don't repeat the headline as the paragraph below it (the no-LLM fallback, or an LLM that echoes itself).
  const showSummary = !!c.summary && c.summary.trim() !== (c.bottomLine ?? "").trim();

  function copySummary() {
    const lines = [
      c.bottomLine,
      c.summary,
      c.conclusions.length ? "\nKey findings:" : "",
      ...c.conclusions.map((t) => `• ${t}`),
      c.actions.length ? "\nWhat to do next:" : "",
      ...c.actions.map((a, i) => `${i + 1}. ${a.title}${a.detail ? ` — ${a.detail}` : ""}`),
    ].filter(Boolean);
    navigator.clipboard?.writeText(lines.join("\n")).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {}
    );
  }

  return (
    <section className="card relative overflow-hidden border border-[#ff5740]/25 p-0">
      {/* Warm accent strip — ties the panel to the brand's coral identity. */}
      <div className="h-1 w-full bg-gradient-to-r from-[#ff5740] via-[#ff8a4c] to-transparent" aria-hidden />

      <div className="space-y-5 p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#ff5740]/15 text-[#ff5740]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden>
                <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
              </svg>
            </span>
            <h3 className="font-display text-[15px] font-semibold text-slate-100">What this means</h3>
            {grounded && (
              <span
                className="hidden items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 sm:inline-flex"
                title="Every number in this summary was checked against your data."
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Figures checked
              </span>
            )}
          </div>
          <button
            type="button"
            data-export-exclude
            onClick={copySummary}
            className="shrink-0 rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
            aria-label="Copy summary to clipboard"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>

        {/* The one-line headline — the decision-first read. */}
        {c.bottomLine && (
          <p className="font-display text-[20px] font-semibold leading-snug text-slate-50 sm:text-[22px]">
            {c.bottomLine}
          </p>
        )}

        {/* Plain-language paragraph. */}
        {showSummary && <p className="text-[14px] leading-relaxed text-slate-300">{c.summary}</p>}

        {/* Key findings — numbered, in scannable cards. */}
        {c.conclusions.length > 0 && (
          <div>
            <SectionLabel>Key findings</SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {c.conclusions.map((t, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-xl border border-[var(--line)] bg-slate-900/40 p-3.5"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ff5740]/15 text-[12px] font-bold text-[#ff5740]">
                    {i + 1}
                  </span>
                  <span className="text-[13.5px] leading-relaxed text-slate-200">{t}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What the charts show. */}
        {c.chartInsights && c.chartInsights.length > 0 && (
          <div>
            <SectionLabel>What the charts show</SectionLabel>
            <ul className="space-y-2">
              {c.chartInsights.map((ci, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-300">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0 text-[#ff8a4c]" aria-hidden>
                    <path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 4-5" />
                  </svg>
                  <span>
                    <span className="font-semibold text-slate-100">{ci.chart}:</span> {ci.insight}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Ranked next steps — interactive cards that lift on hover. */}
        {c.actions.length > 0 && (
          <div>
            <SectionLabel>What to do next</SectionLabel>
            <div className="space-y-2">
              {c.actions.map((a, i) => (
                <div
                  key={i}
                  className="group flex gap-3 rounded-xl border border-[var(--line)] bg-slate-900/40 p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-[#ff5740]/45 hover:bg-slate-900/70"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center self-start rounded-lg bg-[#ff5740] text-[13px] font-bold text-white shadow-sm shadow-[#ff5740]/30">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-slate-100">{a.title}</div>
                    {a.detail && <div className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{a.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="border-t border-slate-800 pt-3 text-[11px] leading-relaxed text-slate-500">{c.disclaimer}</p>
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="h-3 w-1 rounded-full bg-[#ff5740]" aria-hidden />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{children}</span>
    </div>
  );
}
