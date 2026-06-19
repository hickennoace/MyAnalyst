import type { Caveat } from "@/lib/types";

// "Read with care" strip - propagates the data-quality scorecard's findings to the top of the analysis
// so a polished dashboard never silently rests on incomplete columns or too few rows. Renders from
// precomputed metadata; appears on the shared view and in exports too.

export function CaveatStrip({ caveats, smallSample }: { caveats?: Caveat[]; smallSample?: boolean }) {
  if ((!caveats || caveats.length === 0) && !smallSample) return null;
  return (
    <div className="card flex gap-3 border-amber-500/30 bg-amber-500/[0.06] p-4">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" />
      </svg>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-amber-300">Read these results with care</p>
        <ul className="mt-1 space-y-0.5 text-[11px] text-amber-200">
          {smallSample && (
            <li>Only a handful of rows - estimates are unstable and may swing with one more data point.</li>
          )}
          {caveats?.map((c) => (
            <li key={c.column}>
              <span className="font-medium">{c.column}</span>: {c.reason}
              {c.severity === "bad" && <span className="ml-1 rounded bg-amber-500/20 px-1 text-[10px] font-medium">major</span>}
              {" "}- figures using it may be off.
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[10px] text-amber-200/75">From the data-quality check below. Fix the source and re-run for firmer numbers.</p>
      </div>
    </div>
  );
}
