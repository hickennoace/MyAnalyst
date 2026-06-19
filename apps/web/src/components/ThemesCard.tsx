import type { TextAnalysis } from "@/lib/types";

// Open-text themes + sentiment card: for a free-text column, the recurring phrases (with how often they
// come up and a representative quote) and the overall sentiment split. Renders from precomputed analysis.

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function SentimentBar({ s }: { s: NonNullable<TextAnalysis["sentiment"]> }) {
  const seg = [
    { w: s.positive, cls: "bg-emerald-400/80", label: "positive" },
    { w: s.neutral, cls: "bg-slate-500/70", label: "neutral" },
    { w: s.negative, cls: "bg-rose-400/80", label: "negative" },
  ];
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800" role="img" aria-label={`${pct(s.positive)} positive, ${pct(s.neutral)} neutral, ${pct(s.negative)} negative`}>
        {seg.map((x) => x.w > 0 && <div key={x.label} className={x.cls} style={{ width: `${x.w * 100}%` }} title={`${x.label} ${pct(x.w)}`} />)}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span className="text-emerald-400/80">▲ {pct(s.positive)} positive</span>
        <span>{pct(s.neutral)} neutral</span>
        <span className="text-rose-400/80">▼ {pct(s.negative)} negative</span>
      </div>
    </div>
  );
}

export function ThemesCard({ analyses }: { analyses: TextAnalysis[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {analyses.map((a) => (
        <div key={a.column} className="card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-slate-100">{a.column}</p>
            <p className="text-[11px] text-slate-500">{a.responseCount.toLocaleString()} responses · ~{a.avgWords} words</p>
          </div>

          {a.sentiment && (
            <div className="mt-3">
              <SentimentBar s={a.sentiment} />
            </div>
          )}

          <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-slate-500">Recurring themes</p>
          <ul className="mt-2 space-y-2.5">
            {a.terms.map((t) => (
              <li key={t.term}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium capitalize text-slate-200">{t.term}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">{t.count}× · {pct(t.share)}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-[#ff5740]/70" style={{ width: `${Math.max(4, Math.min(100, t.share * 100))}%` }} />
                </div>
                {t.sample && <p className="mt-1 truncate text-[11px] italic text-slate-500" title={t.sample}>“{t.sample}”</p>}
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[11px] text-slate-500">
            Themes are the most frequent phrases; sentiment is a lexicon estimate — skim the quotes for nuance.
          </p>
        </div>
      ))}
    </div>
  );
}
