import { describe, expect, it } from "vitest";
import { cagr, linearRegression, mean, median, pearson, std, zOutliers } from "./stats";

describe("stats", () => {
  it("mean / median / std", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([1, 2, 3])).toBe(2);
    expect(std([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
  });

  it("pearson: perfect positive & negative", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 5);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 5);
  });

  it("pearson: too few points → NaN", () => {
    expect(Number.isNaN(pearson([1, 2], [1, 2]))).toBe(true);
  });

  it("linearRegression: fits a perfect line with R²=1", () => {
    const r = linearRegression([0, 1, 2, 3], [1, 3, 5, 7]); // y = 2x + 1
    expect(r.slope).toBeCloseTo(2, 6);
    expect(r.intercept).toBeCloseTo(1, 6);
    expect(r.r2).toBeCloseTo(1, 6);
  });

  it("zOutliers flags an extreme value", () => {
    // Enough tight points so one extreme value clears 3σ (a lone outlier in a tiny sample inflates σ).
    const out = zOutliers([...Array(20).fill(10), 100], 3);
    expect(out.length).toBe(1);
    expect(out[0].value).toBe(100);
  });

  it("cagr", () => {
    expect(cagr(100, 200, 1)).toBeCloseTo(1, 6); // doubled in one period → 100%
    expect(Number.isNaN(cagr(0, 100, 4))).toBe(true);
  });
});
