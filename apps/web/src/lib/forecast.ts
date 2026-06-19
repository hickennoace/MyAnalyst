// Time-series forecasting. Two methods, fully local and dependency-free:
//   • Holt's linear trend (double exponential smoothing) - level + trend.
//   • Holt-Winters (triple exponential smoothing, additive) - level + trend + a repeating seasonal
//     term, used when the series has a detectable season so the projection keeps the cyclical shape
//     instead of flattening it into a straight drift.
// Smoothing params are fit by a small grid search minimizing in-sample squared error - good enough
// for the short horizons we project.

export interface Forecast {
  /** in-sample one-step fitted values (same length as input). */
  fitted: number[];
  /** projected values beyond the series. */
  forecast: number[];
  alpha: number;
  beta: number;
  /** seasonal smoothing parameter - only set for Holt-Winters forecasts. */
  gamma?: number;
  /** detected season length (in observations) - only set for Holt-Winters forecasts. */
  period?: number;
  /** true when a seasonal model was used (the projection follows the cycle, not just a trend). */
  seasonal?: boolean;
  /** last observed value and the final projected value, for convenience. */
  lastValue: number;
  projected: number;
  /** standard deviation of the in-sample one-step residuals - the basis for prediction intervals. */
  residualStd: number;
}

/**
 * Prediction interval around the point forecast. Uncertainty grows with the horizon (√h), the standard
 * widening for a random-walk-with-drift error process - honest about how much less we know further out.
 */
export function forecastBand(fc: Forecast, z = 1.96): { lower: number[]; upper: number[] } {
  return {
    lower: fc.forecast.map((v, h) => v - z * fc.residualStd * Math.sqrt(h + 1)),
    upper: fc.forecast.map((v, h) => v + z * fc.residualStd * Math.sqrt(h + 1)),
  };
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

  // Residual std from the one-step fitted values (skip t=0, which is seeded, not predicted).
  let sse = 0;
  let m = 0;
  for (let t = 1; t < clean.length; t++) {
    sse += (clean[t] - best.fitted[t]) ** 2;
    m++;
  }
  const residualStd = m > 1 ? Math.sqrt(sse / (m - 1)) : 0;

  return {
    fitted: best.fitted,
    forecast: best.forecast,
    alpha: best.alpha,
    beta: best.beta,
    lastValue: clean[clean.length - 1],
    projected: best.forecast[best.forecast.length - 1],
    residualStd,
  };
}

/**
 * Detect a repeating season length straight from the series via autocorrelation: demean, then for each
 * lag measure how strongly the series correlates with itself shifted by that lag. The first clear peak
 * (a local maximum above a correlation threshold, requiring ≥2 full cycles) is the fundamental period.
 * Returns null when nothing repeats. Pure; exported for testing.
 */
export function detectPeriod(series: number[], threshold = 0.3): number | null {
  const raw = series.filter(Number.isFinite);
  if (raw.length < 9) return null;
  // First-difference to strip the trend - a sloped line autocorrelates at every lag, which would
  // masquerade as seasonality. Differencing leaves a genuine seasonal cycle intact at the same period.
  const x: number[] = [];
  for (let t = 1; t < raw.length; t++) x.push(raw[t] - raw[t - 1]);
  const n = x.length;

  const mean = x.reduce((s, v) => s + v, 0) / n;
  const dev = x.map((v) => v - mean);
  const denom = dev.reduce((s, v) => s + v * v, 0);
  if (denom === 0) return null; // constant slope - pure trend, no season

  const maxLag = Math.min(Math.floor(n / 2), 366);
  const acf: number[] = [0]; // acf[0] unused
  for (let lag = 1; lag <= maxLag; lag++) {
    let s = 0;
    for (let t = lag; t < n; t++) s += dev[t] * dev[t - lag];
    acf.push(s / denom);
  }

  // The fundamental period is the first genuine local maximum above the threshold (its multiples also
  // peak, but weaker). No global-argmax fallback: a trend without a real peak must return null.
  for (let lag = 2; lag < maxLag; lag++) {
    if (acf[lag] >= threshold && acf[lag] > acf[lag - 1] && acf[lag] >= acf[lag + 1]) return lag;
  }
  return null;
}

/** Additive Holt-Winters pass: returns one-step fitted values, the forecast, and in-sample SSE. */
function holtWinters(series: number[], alpha: number, beta: number, gamma: number, period: number, horizon: number) {
  const n = series.length;
  // Seed: level = mean of the first season; trend = average per-step climb between the first two
  // seasons; seasonals = each position's deviation from the first season's mean.
  let level = series.slice(0, period).reduce((s, v) => s + v, 0) / period;
  let trend = 0;
  for (let i = 0; i < period; i++) trend += (series[period + i] - series[i]) / period;
  trend /= period;
  const season: number[] = series.slice(0, period).map((v) => v - level);

  const fitted: number[] = series.slice(0, period); // first cycle is seed, not predicted
  let sse = 0;
  for (let t = period; t < n; t++) {
    const pred = level + trend + season[t - period]; // one-step-ahead, made at t-1
    fitted.push(pred);
    sse += (series[t] - pred) ** 2;
    const prevLevel = level;
    level = alpha * (series[t] - season[t - period]) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    season.push(gamma * (series[t] - level) + (1 - gamma) * season[t - period]);
  }

  const forecast: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    forecast.push(level + h * trend + season[n - period + ((h - 1) % period)]);
  }
  return { fitted, forecast, sse };
}

/** Fit additive Holt-Winters (grid-searching alpha/beta/gamma) for a known season length. */
export function holtWintersForecast(series: number[], horizon: number, period: number): Forecast | null {
  const clean = series.filter((x) => Number.isFinite(x));
  if (period < 2 || clean.length < 2 * period) return null; // need ≥2 full seasons

  let best = { alpha: 0.4, beta: 0.1, gamma: 0.2, sse: Infinity, fitted: [] as number[], forecast: [] as number[] };
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 9; b++) {
      for (let g = 1; g <= 9; g++) {
        const alpha = a / 10, beta = b / 10, gamma = g / 10;
        const r = holtWinters(clean, alpha, beta, gamma, period, horizon);
        if (r.sse < best.sse) best = { alpha, beta, gamma, sse: r.sse, fitted: r.fitted, forecast: r.forecast };
      }
    }
  }

  // Residual std from the one-step fitted values (the seeded first season is excluded).
  let sse = 0;
  let m = 0;
  for (let t = period; t < clean.length; t++) { sse += (clean[t] - best.fitted[t]) ** 2; m++; }
  const residualStd = m > 1 ? Math.sqrt(sse / (m - 1)) : 0;

  return {
    fitted: best.fitted,
    forecast: best.forecast,
    alpha: best.alpha,
    beta: best.beta,
    gamma: best.gamma,
    period,
    seasonal: true,
    lastValue: clean[clean.length - 1],
    projected: best.forecast[best.forecast.length - 1],
    residualStd,
  };
}

/**
 * Best available forecast: when the series has a detectable season, use Holt-Winters so the projection
 * keeps the cyclical shape; otherwise fall back to Holt's linear trend. The single entry point callers
 * should use.
 */
export function forecastSeries(series: number[], horizon: number): Forecast | null {
  const clean = series.filter((x) => Number.isFinite(x));
  const period = detectPeriod(clean);
  if (period && clean.length >= 2 * period) {
    const hw = holtWintersForecast(clean, horizon, period);
    if (hw) return hw;
  }
  return holtForecast(series, horizon);
}

/** Sensible horizon: ~15% of the series, clamped to [3, 12]. */
export function defaultHorizon(length: number): number {
  return Math.max(3, Math.min(12, Math.round(length * 0.15)));
}
