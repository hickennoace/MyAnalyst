// Time-series forecasting via Holt's linear trend (double exponential smoothing).
// Dependency-free. Smoothing params (alpha, beta) are fit by a small grid search minimizing
// in-sample squared error — good enough for the short horizons we project, and fully local.

export interface Forecast {
  /** in-sample one-step fitted values (same length as input). */
  fitted: number[];
  /** projected values beyond the series. */
  forecast: number[];
  alpha: number;
  beta: number;
  /** last observed value and the final projected value, for convenience. */
  lastValue: number;
  projected: number;
}

function holt(series: number[], alpha: number, beta: number, horizon: number) {
  let level = series[0];
  let trend = series[1] - series[0];
  const fitted: number[] = [series[0]];
  let sse = 0;
  for (let t = 1; t < series.length; t++) {
    const pred = level + trend; // one-step-ahead forecast
    fitted.push(pred);
    sse += (series[t] - pred) ** 2;
    const newLevel = alpha * series[t] + (1 - alpha) * (level + trend);
    trend = beta * (newLevel - level) + (1 - beta) * trend;
    level = newLevel;
  }
  const forecast: number[] = [];
  for (let h = 1; h <= horizon; h++) forecast.push(level + h * trend);
  return { fitted, forecast, sse };
}

/** Fit Holt's method (grid-searching alpha/beta) and project `horizon` steps ahead. */
export function holtForecast(series: number[], horizon: number): Forecast | null {
  const clean = series.filter((x) => Number.isFinite(x));
  if (clean.length < 6) return null; // too short to trust a trend

  let best = { alpha: 0.5, beta: 0.3, sse: Infinity, fitted: [] as number[], forecast: [] as number[] };
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 9; b++) {
      const alpha = a / 10;
      const beta = b / 10;
      const r = holt(clean, alpha, beta, horizon);
      if (r.sse < best.sse) best = { alpha, beta, sse: r.sse, fitted: r.fitted, forecast: r.forecast };
    }
  }

  return {
    fitted: best.fitted,
    forecast: best.forecast,
    alpha: best.alpha,
    beta: best.beta,
    lastValue: clean[clean.length - 1],
    projected: best.forecast[best.forecast.length - 1],
  };
}

/** Sensible horizon: ~15% of the series, clamped to [3, 12]. */
export function defaultHorizon(length: number): number {
  return Math.max(3, Math.min(12, Math.round(length * 0.15)));
}
