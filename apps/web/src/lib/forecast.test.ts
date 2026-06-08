import { describe, expect, it } from "vitest";
import { defaultHorizon, forecastBand, holtForecast } from "./forecast";

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
