import type { DataQuality } from "@/lib/types";

// Data-quality scorecard: a score ring + per-dimension breakdown with concrete fixes. Renders purely
// from the precomputed DataQuality, so it works on both the live analyzer and the read-only shared view.

const STATUS: Record<DataQuality["checks"][number]["status"], { dot: string; text: string; ring: string }> = {
  good: { dot: "bg-emerald-400", text: "text-emerald-300", ring: "text-emerald-400" },
  warn: { dot: "bg-amber-400", text: "text-amber-300", ring: "text-amber-400" },
  bad: { dot: "bg-rose-400", text: "text-rose-300", ring: "text-rose-400" },
};

function gradeColor(grade: DataQuality["grade"]): string {
  return grade === "A" ? "text-emerald-300" : grade === "B" ? "text-lime-300" : grade === "C" ? "text-amber-300" : grade === "D" ? "text-orange-300" : "text-rose-300";
}

export function QualityCard({ quality }: { quality: DataQuality }) {
  const { score, grade, checks, summary } = quality;
  const overall: DataQuality["checks"][number]["status"] = score >= 80 ? "good" : score >= 60 ? "warn" : "bad";
  const circ = 2 * Math.PI * 42;

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* Score ring */}
        <div className="relative grid h-28 w-28 shrink-0 place-items-center" role="img" aria-label={`Data quality score ${score} out of 100, grade ${grade}`}>
          <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-800" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              className={STATUS[overall].ring}
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - score / 100)}
              style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
            />
          </svg>
          <div className="absolute text-center">
            <div className={`text-3xl font-bold tabular-nums ${gradeColor(grade)}`}>{score}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">/ 100 · {grade}</div>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Data quality score</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{summary}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {checks.map((c) => {
          const s = STATUS[c.status];
          return (
            <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
                  <span className="text-xs font-medium text-slate-200">{c.label}</span>
                </div>
                <span className={`text-xs font-semibold tabular-nums ${s.text}`}>{Math.round(c.score * 100)}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{c.detail}</p>
              {c.fix && <p className="mt-1 text-[11px] leading-relaxed text-blue-300/80">→ {c.fix}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
