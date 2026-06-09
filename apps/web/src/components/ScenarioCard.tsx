"use client";

import { useMemo, useState } from "react";
import type { ColumnProfile, DriverAnalysis } from "@/lib/types";
import { goalSeek, predictTarget, sliderBounds } from "@/lib/scenario";
import { currencySymbol } from "@/lib/currency";

// What-if simulator + goal-seek, driven by the fitted driver model. Sliders move each predictor; the
// projected target updates live with a rough modeled range. Goal-seek inverts the model: enter a target
// change and see how far each single lever would have to move. All client-side — the model carries only
// coefficients + baselines, never raw rows.

function useFmt(p?: ColumnProfile) {
  return useMemo(() => {
    const cur = p?.type === "currency";
    return (n: number) => {
      if (!Number.isFinite(n)) return "—";
      if (cur) return currencySymbol() + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
      const abs = Math.abs(n);
      if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
      if (abs >= 1e3) return (n / 1e3).toFixed(1) + "k";
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
    };
  }, [p]);
}

export function ScenarioCard({ drivers, profiles }: { drivers: DriverAnalysis; profiles: ColumnProfile[] }) {
  const model = drivers.model;
  const targetP = profiles.find((p) => p.name === drivers.target);
  const fmt = useFmt(targetP);
  // Predictor values, initialised at each predictor's mean (the baseline = target mean).
  const [vals, setVals] = useState<Record<string, number>>(() =>
    Object.fromEntries((model?.predictors ?? []).map((p) => [p.name, p.mean]))
  );
  const [goal, setGoal] = useState<string>("");

  if (!model || model.predictors.length === 0) return null;

  const projected = predictTarget(model, vals);
  const baseline = model.targetMean;
  const deltaAbs = projected - baseline;
  const deltaPct = baseline !== 0 ? (deltaAbs / Math.abs(baseline)) * 100 : 0;
  // Honest modelled range: residual spread ≈ targetStd·√(1−R²).
  const band = model.targetStd * Math.sqrt(Math.max(0, 1 - drivers.r2));

  const goalDelta = goal.trim() === "" ? null : Number(goal.replace(/[^0-9.\-]/g, ""));
  const suggestions = goalDelta !== null && Number.isFinite(goalDelta) && goalDelta !== 0 ? goalSeek(model, goalDelta) : [];

  return (
    <div className="card p-5">
      {/* Projected outcome */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-slate-400">Projected {drivers.target}</p>
          <p className="text-3xl font-bold tabular-nums text-slate-100">{fmt(projected)}</p>
          <p className="text-[11px] text-slate-500">
            modelled range {fmt(projected - band)} – {fmt(projected + band)}
          </p>
        </div>
        <div className="text-right">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${deltaAbs >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
            <span aria-hidden>{deltaAbs >= 0 ? "▲" : "▼"}</span>
            {deltaAbs >= 0 ? "+" : "−"}{fmt(Math.abs(deltaAbs))} ({deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%)
          </span>
          <p className="mt-1 text-[11px] text-slate-500">vs baseline {fmt(baseline)}</p>
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-5 space-y-4">
        {model.predictors.map((p) => {
          const b = sliderBounds(p);
          const sig = drivers.drivers.find((d) => d.name === p.name)?.significant;
          const cur = vals[p.name] ?? p.mean;
          return (
            <div key={p.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-200">
                  {p.name}
                  {sig === false && <span className="text-[10px] text-slate-500">· weak effect</span>}
                </span>
                <span className="tabular-nums text-slate-300">{fmt(cur)}</span>
              </div>
              <input
                type="range"
                min={b.min}
                max={b.max}
                step={b.step}
                value={cur}
                onChange={(e) => setVals((v) => ({ ...v, [p.name]: Number(e.target.value) }))}
                className="mt-1.5 w-full accent-blue-500"
                aria-label={`${p.name} value`}
              />
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>{fmt(b.min)}</span>
                <span>avg {fmt(p.mean)}</span>
                <span>{fmt(b.max)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
        <button
          type="button"
          onClick={() => setVals(Object.fromEntries(model.predictors.map((p) => [p.name, p.mean])))}
          className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Reset to average
        </button>
        <p className="text-[11px] text-slate-500">Drag a factor; the projection updates from the model, holding the others where you set them.</p>
      </div>

      {/* Goal-seek */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <label className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span>I want {drivers.target} to change by</span>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            inputMode="decimal"
            placeholder={`e.g. ${Math.round(Math.abs(baseline) * 0.1) || 10}`}
            className="w-28 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 outline-none focus:border-blue-500"
          />
          <span>(in {targetP?.type === "currency" ? "$" : "units"})</span>
        </label>
        {suggestions.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-xs">
            {suggestions.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-2">
                <span className="text-slate-200">
                  Move <span className="font-medium">{s.name}</span> to {fmt(s.toValue)}
                  <span className="text-slate-500"> ({s.deltaX >= 0 ? "+" : "−"}{fmt(Math.abs(s.deltaX))})</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.withinRange ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                  {s.withinRange ? `${s.sds.toFixed(1)} SD · in range` : "beyond observed range"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {goalDelta !== null && suggestions.length === 0 && (
          <p className="mt-2 text-[11px] text-slate-500">Enter a non-zero number to see which levers could get there.</p>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Projections come from the fitted model and assume the relationships hold and other factors stay put — association, not
        proven cause. Treat as a planning aid, not a guarantee.
      </p>
    </div>
  );
}
