import { describe, expect, it } from "vitest";
import { defaultHorizon, detectPeriod, forecastBand, forecastSeries, holtForecast, holtWintersForecast } from "./forecast";

// An additive seasonal series: gentle upward trend + a fixed 12-step seasonal swing.
const SEASON = [8, 3, -2, -6, -9, -5, 0, 4, 9, 6, 1, -4]; // sums ~0, peaks at position 8
function seasonalSeries(seasons: number, trend = 0.5, level = 100): number[] {
  const out: number[] = [];
  for (let t = 0; t < seasons * SEASON.length; t++) out.push(level + trend * t + SEASON[t % SEASON.length]);
  return out;
}

function mse(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s / a.length;
}

describe("holtForecast", () => {
  it("projects an increasing trend upward", () => {
    const series = Array.from({ length: 20 }, (_, i) => 100 + i * 5); // strictly increasing
    const fc = holtForecast(series, 4);
    expect(fc).not.toBeNull();
    expect(fc!.projected).toBeGreaterThan(fc!.lastValue);
    expect(fc!.forecast.length).toBe(4);
  });

  it("returns null for too-short series", () => {
    expect(holtForecast([1, 2, 3], 3)).toBeNull();
  });

  it("defaultHorizon clamps to [3, 12]", () => {
    expect(defaultHorizon(10)).toBe(3);
    expect(defaultHorizon(1000)).toBe(12);
    expect(defaultHorizon(60)).toBe(9);
  });

  it("forecastBand widens with the horizon and brackets the forecast", () => {
    // noisy upward series so residualStd > 0
    const series = Array.from({ length: 24 }, (_, i) => 100 + i * 5 + (i % 3 === 0 ? 12 : -7));
    const fc = holtForecast(series, 6)!;
    expect(fc.residualStd).toBeGreaterThan(0);
    const { lower, upper } = forecastBand(fc);
    expect(lower.length).toBe(6);
    for (let h = 0; h < 6; h++) {
      expect(lower[h]).toBeLessThanOrEqual(fc.forecast[h]);
      expect(upper[h]).toBeGreaterThanOrEqual(fc.forecast[h]);
    }
    // interval half-width grows with horizon (√h)
    expect(upper[5] - lower[5]).toBeGreaterThan(upper[0] - lower[0]);
  });
});

describe("detectPeriod", () => {
  it("finds the fundamental season length of a seasonal series", () => {
    expect(detectPeriod(seasonalSeries(4))).toBe(12);
  });

  it("finds a weekly (7) period", () => {
    const wk = [0, 0, 0, 0, 0, 6, 8]; // weekend bump
    const series = Array.from({ length: 7 * 6 }, (_, t) => 20 + 0.1 * t + wk[t % 7]);
    expect(detectPeriod(series)).toBe(7);
  });

  it("returns null for a non-seasonal trend", () => {
    expect(detectPeriod(Array.from({ length: 40 }, (_, i) => 100 + i * 5))).toBeNull();
  });

  it("returns null when the series is too short for two full seasons", () => {
    expect(detectPeriod(SEASON.map((s, t) => 100 + t + s))).toBeNull(); // only one season
  });
});

describe("holtWintersForecast", () => {
  it("reproduces the seasonal shape in its projection", () => {
    const series = seasonalSeries(4); // 48 points, period 12
    const fc = holtWintersForecast(series, 12, 12)!;
    expect(fc).not.toBeNull();
    expect(fc.seasonal).toBe(true);
    expect(fc.period).toBe(12);
    // The projected season should track the known pattern: the peak (position 8) stays well above
    // the trough (position 4) in the forecast, not flattened out the way plain Holt would do.
    expect(fc.forecast[8] - fc.forecast[4]).toBeGreaterThan(10);
  });

  it("forecasts a held-out final season far better than plain Holt", () => {
    const full = seasonalSeries(5); // 60 points
    const train = full.slice(0, 48);
    const actual = full.slice(48); // the held-out final season
    const hw = holtWintersForecast(train, 12, 12)!;
    const holt = holtForecast(train, 12)!;
    expect(mse(hw.forecast, actual)).toBeLessThan(mse(holt.forecast, actual) * 0.25);
  });

  it("returns null without at least two full seasons", () => {
    expect(holtWintersForecast(seasonalSeries(1), 6, 12)).toBeNull();
  });
});

describe("forecastSeries", () => {
  it("uses Holt-Winters on seasonal data", () => {
    const fc = forecastSeries(seasonalSeries(4), 6)!;
    expect(fc.seasonal).toBe(true);
    expect(fc.period).toBe(12);
  });

  it("falls back to plain Holt when there is no seasonality", () => {
    const fc = forecastSeries(Array.from({ length: 30 }, (_, i) => 100 + i * 5), 6)!;
    expect(fc.seasonal).toBeFalsy();
    expect(fc.forecast.length).toBe(6);
    expect(fc.projected).toBeGreaterThan(fc.lastValue);
  });

  it("returns null for a too-short series", () => {
    expect(forecastSeries([1, 2, 3], 3)).toBeNull();
  });
});
