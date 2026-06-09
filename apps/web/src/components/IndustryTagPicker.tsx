"use client";

import { useState } from "react";
import { INDUSTRY_TAGS } from "@/lib/industry-tags";

// The industry-tag chip cloud. With ~28 tags, a flat wall of chips is noisy, so we show a curated first
// row and reveal the rest behind a "+N more" toggle. The selected tag is always visible (promoted to the
// front when it sits beyond the fold).
export function IndustryTagPicker({
  value,
  onChange,
  label = "tag your industry:",
  justify = "center",
  size = "md",
}: {
  value: string | null | undefined;
  onChange: (key: string | null) => void;
  label?: string;
  justify?: "center" | "start";
  size?: "sm" | "md";
}) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL = 9;

  // Keep the active tag visible even when it lives past the fold.
  const ordered = value
    ? [...INDUSTRY_TAGS].sort((a, b) => (a.key === value ? -1 : b.key === value ? 1 : 0))
    : INDUSTRY_TAGS;
  const shown = showAll ? ordered : ordered.slice(0, INITIAL);
  const hidden = INDUSTRY_TAGS.length - INITIAL;

  const pad = size === "sm" ? "px-2.5 py-0.5" : "px-3 py-1";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${justify === "center" ? "justify-center" : ""}`}>
      <span className="mr-0.5 text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      {shown.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : t.key)}
            className={`rounded-full border ${pad} text-xs transition hover:-translate-y-0.5 ${
              active
                ? "border-blue-400 bg-blue-500/15 text-blue-200"
                : "border-slate-700 text-slate-300 hover:border-blue-500/50 hover:text-blue-300"
            }`}
          >
            {t.label}
          </button>
        );
      })}
      {!showAll && hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className={`rounded-full border border-dashed border-slate-600 ${pad} text-xs text-slate-400 transition hover:border-blue-500/50 hover:text-blue-300`}
        >
          +{hidden} more
        </button>
      )}
      {showAll && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className={`rounded-full ${pad} text-xs text-slate-500 transition hover:text-slate-300`}
        >
          show less
        </button>
      )}
    </div>
  );
}
