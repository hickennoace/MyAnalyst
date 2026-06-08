import type { DriverModel } from "./types";

// What-if simulation + goal-seek on the driver regression. Both run entirely client-side from the
// fitted model's coefficients and baselines (no raw rows). Because an OLS fit passes through the
// sample means, the modeled outcome with every predictor at its mean equals the target's mean — so we
// project from there: outcome = targetMean + Σ coefᵢ·(xᵢ − meanᵢ).

/** Project the target given absolute predictor values (missing predictors stay at their mean). */
export function predictTarget(model: DriverModel, values: Record<string, number>): number {
  let out = model.targetMean;
  for (const p of model.predictors) {
    const x = values[p.name];
    if (Number.isFinite(x)) out += p.coef * (x - p.mean);
  }
  return out;
}

export interface LeverSuggestion {
  name: string;
  /** absolute change required in this predictor (from its mean) to hit the target alone. */
  deltaX: number;
  /** the predictor value it would have to reach. */
  toValue: number;
  /** that move expressed in standard deviations — a feasibility proxy (smaller = easier). */
  sds: number;
  /** whether the required value stays within the observed [min, max] range. */
  withinRange: boolean;
}

/**
 * Goal-seek: to move the target by `targetDelta` (absolute, in the target's units), how far would each
 * single lever have to move on its own? Returns the levers ranked most-feasible first (smallest move in
 * standard deviations, in-range before out-of-range). Levers with a ~zero coefficient are dropped — they
 * can't move the target.
 */
export function goalSeek(model: DriverModel, targetDelta: number): LeverSuggestion[] {
  const out: LeverSuggestion[] = [];
  for (const p of model.predictors) {
    if (Math.abs(p.coef) < 1e-12) continue;
    const deltaX = targetDelta / p.coef;
    const toValue = p.mean + deltaX;
    const sds = p.std > 0 ? Math.abs(deltaX) / p.std : Infinity;
    out.push({ name: p.name, deltaX, toValue, sds, withinRange: toValue >= p.min && toValue <= p.max });
  }
  return out.sort((a, b) => Number(b.withinRange) - Number(a.withinRange) || a.sds - b.sds);
}

/** Slider bounds for a predictor: a little past its observed range so users can explore beyond history. */
export function sliderBounds(p: DriverModel["predictors"][number]): { min: number; max: number; step: number } {
  const span = p.max - p.min || Math.abs(p.mean) || 1;
  const pad = span * 0.25;
  const min = p.min - pad;
  const max = p.max + pad;
  return { min, max, step: (max - min) / 100 };
}
