// Animated, accessible pipeline progress — shows each analysis stage with done / active / pending
// states (a checkmark, a pulsing dot, or a dim dot) and a gradient progress bar.

export function PipelineProgress({ stages, current }: { stages: string[]; current: string | null }) {
  const idx = current ? stages.indexOf(current) : -1;
  const pct = idx < 0 ? 0 : ((idx + 1) / stages.length) * 100;

  return (
    <div className="card p-5" role="status" aria-live="polite">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100">Analyzing your data…</p>
        <span className="text-xs text-slate-400">{Math.round(pct)}%</span>
      </div>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-cyan-400 transition-all duration-300"
          style={{ width: `${pct}%`, backgroundSize: "200% 100%", animation: "gradientPan 2.4s linear infinite" }}
        />
      </div>

      <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {stages.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li key={s} className="flex items-center gap-2.5 text-xs">
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold transition ${
                  done
                    ? "bg-emerald-500/20 text-emerald-300"
                    : active
                    ? "bg-blue-500 text-white"
                    : "bg-slate-800 text-slate-600"
                }`}
                style={active ? { animation: "stepPulse 1.4s ease-in-out infinite" } : undefined}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={done ? "text-slate-400" : active ? "font-medium text-slate-100" : "text-slate-600"}>
                {s}
                {active && <span className="type-caret ml-0.5">…</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
