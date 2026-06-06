import { describe, expect, it } from "vitest";
import { defaultHorizon, holtForecast } from "./forecast";

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
});
