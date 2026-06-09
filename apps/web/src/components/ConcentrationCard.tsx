import type { ColumnProfile, Concentration, Table } from "@/lib/types";
import { concentrationMembers } from "@/lib/concentration";
import { DownloadCsvButton } from "./DownloadCsvButton";
import { currencySymbol } from "@/lib/currency";

// Concentration / Pareto card: how much of a measure the biggest few categories hold. Sorted bars with
// a running cumulative share, the "vital few" highlighted up to the 80% line, plus the concentration
// indices (Gini / HHI) and a plain-language risk read. Renders from precomputed data (shared view too).

function fmt(n: number, p?: ColumnProfile): string {
  if (!Number.isFinite(n)) return "—";
  if (p?.type === "currency") {
    const sym = currencySymbol();
    const abs = Math.abs(n);
    if (abs >= 1e6) return sym + (n / 1e6).toFixed(1) + "M";
    if (abs >= 1e3) return sym + (n / 1e3).toFixed(1) + "k";
    return sym + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  }
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
}

const pct = (x: number) => `${(x * 100).toFixed(x >= 0.1 ? 0 : 1)}%`;

const LEVEL: Record<Concentration["level"], { label: string; cls: string }> = {
  high: { label: "Highly concentrated", cls: "bg-amber-500/15 text-amber-300" },
  moderate: { label: "Moderately concentrated", cls: "bg-sky-500/15 text-sky-300" },
  low: { label: "Fairly even", cls: "bg-emerald-500/15 text-emerald-300" },
};

function One({ c, profiles, table }: { c: Concentration; profiles: ColumnProfile[]; table?: Table | null }) {
  const metricProfile = profiles.find((p) => p.name === c.metric);
  const measure = c.metricIsCount ? "the rows" : c.metric;
  const lvl = LEVEL[c.level];
  const max = c.segments[0]?.share ?? 1;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">
          {c.metricIsCount ? "Row count" : c.metric} by {c.dimension}
        </h3>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${lvl.cls}`}>{lvl.label}</span>
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
        The top <strong className="text-slate-100">{c.paretoCount}</strong> of {c.distinct} {c.dimension}
        {c.paretoCount === 1 ? "" : "s"} ({pct(c.paretoPctOfCategories)} of them) account for{" "}
        <strong className="text-slate-100">{pct(c.paretoShare)}</strong> of {measure}.
        {c.level === "high" && " That's real concentration — a few movers carry the whole number."}
      </p>

      <div className="mt-4 space-y-1.5">
        {c.segments.map((s) => {
          const vital = !s.isOther && s.rank <= c.paretoCount;
          return (
            <div key={`${s.name}-${s.rank}`} className="flex items-center gap-2 text-[12px]">
              <span className={`w-28 shrink-0 truncate ${s.isOther ? "italic text-slate-500" : "text-slate-300"}`} title={s.name}>
                {s.name}
              </span>
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-slate-800/50">
                <div
                  className={`h-full rounded ${vital ? "bg-gradient-to-r from-blue-500 to-cyan-400" : "bg-slate-600"}`}
                  style={{ width: `${Math.max(2, (s.share / max) * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right tabular-nums text-slate-400">{pct(s.share)}</span>
              <span className="w-14 shrink-0 text-right tabular-nums text-slate-500" title="cumulative share">
                Σ {pct(s.cumShare)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--line)] pt-3 text-[11px] text-slate-400">
        <span>
          Top category: <strong className="text-slate-300">{pct(c.topShare)}</strong>
        </span>
        <span title="Gini coefficient — 0 is perfectly even, 1 is everything in one category">
          Gini <strong className="text-slate-300">{c.gini.toFixed(2)}</strong>
        </span>
        <span title="Herfindahl–Hirschman index — higher means more concentrated">
          HHI <strong className="text-slate-300">{c.hhi.toFixed(2)}</strong>
        </span>
        <span>
          Total {fmt(c.total, metricProfile)} across {c.distinct.toLocaleString()} {c.dimension}s
        </span>
        {table && (
          <span className="ml-auto">
            <DownloadCsvButton
              columns={[c.dimension, c.metricIsCount ? "row_count" : c.metric, "share", "cumulative_share"]}
              rows={concentrationMembers(table, c).map((m) => ({
                [c.dimension]: m.name,
                [c.metricIsCount ? "row_count" : c.metric]: m.value,
                share: +(m.share).toFixed(4),
                cumulative_share: +(m.cumShare).toFixed(4),
              }))}
              filename={`concentration-${c.dimension}`}
              label={`Download top ${c.paretoCount} ${c.dimension}${c.paretoCount === 1 ? "" : "s"}`}
            />
          </span>
        )}
      </div>
    </div>
  );
}

export function ConcentrationCard({ concentration, profiles, table }: { concentration: Concentration[]; profiles: ColumnProfile[]; table?: Table | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {concentration.map((c) => (
        <One key={`${c.dimension}-${c.metric}`} c={c} profiles={profiles} table={table} />
      ))}
    </div>
  );
}
