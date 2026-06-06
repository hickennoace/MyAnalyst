import { describe, expect, it } from "vitest";
import {
  benjaminiHochberg,
  chiSquareIndependence,
  chiSquareP,
  describe as describeStats,
  fDistP,
  multipleRegression,
  normalCdf,
  oneWayAnova,
  olsSimple,
  pearsonTest,
  spearmanTest,
  studentTTwoSidedP,
  tCritical,
} from "./inference";

// Validate the special functions against textbook critical values (≈ tables).
describe("distribution tail probabilities", () => {
  it("Student-t two-sided p matches the t-table", () => {
    expect(studentTTwoSidedP(2.228, 10)).toBeCloseTo(0.05, 2); // t_{.025,10} = 2.228
    expect(studentTTwoSidedP(0, 10)).toBeCloseTo(1, 5);
  });
  it("chi-square upper tail matches the table", () => {
    expect(chiSquareP(3.8415, 1)).toBeCloseTo(0.05, 2);
    expect(chiSquareP(7.815, 3)).toBeCloseTo(0.05, 2);
  });
  it("F upper tail matches the table", () => {
    expect(fDistP(3.708, 3, 10)).toBeCloseTo(0.05, 2); // F_{.05}(3,10) = 3.708
  });
  it("normal CDF", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 3);
  });
  it("tCritical inverts the t survival function", () => {
    expect(tCritical(10, 0.05)).toBeCloseTo(2.228, 2);
  });
});

describe("pearsonTest", () => {
  it("perfect correlation is highly significant", () => {
    const t = pearsonTest([1, 2, 3, 4, 5, 6], [2, 4, 6, 8, 10, 12])!;
    expect(t.r).toBeCloseTo(1, 5);
    expect(t.p).toBeLessThan(0.001);
    expect(t.significant).toBe(true);
  });
  it("no real relationship is not significant", () => {
    const t = pearsonTest([1, 2, 3, 4, 5, 6, 7, 8], [3, 1, 4, 1, 5, 2, 6, 2])!;
    expect(t.significant).toBe(false);
  });
});

describe("olsSimple", () => {
  it("recovers a known line with full inference", () => {
    const r = olsSimple([0, 1, 2, 3, 4, 5], [1, 3, 5, 7, 9, 11])!; // y = 2x + 1
    expect(r.slope).toBeCloseTo(2, 6);
    expect(r.r2).toBeCloseTo(1, 6);
    expect(r.slopeP).toBeLessThan(0.001);
    expect(r.significant).toBe(true);
  });
});

describe("oneWayAnova", () => {
  it("detects a real group difference", () => {
    const groups = new Map([
      ["A", [1, 2, 1, 2, 1]],
      ["B", [9, 10, 9, 10, 11]],
    ]);
    const a = oneWayAnova(groups)!;
    expect(a.significant).toBe(true);
    expect(a.groups[0].name).toBe("B");
  });
});

describe("chiSquareIndependence", () => {
  it("flags associated categories", () => {
    const r = chiSquareIndependence([
      [40, 10],
      [10, 40],
    ])!;
    expect(r.significant).toBe(true);
    expect(r.cramersV).toBeGreaterThan(0.3);
  });
});

describe("describe", () => {
  it("computes quartiles and near-zero skew for symmetric data", () => {
    const d = describeStats([1, 2, 3, 4, 5, 6, 7, 8, 9])!;
    expect(d.median).toBe(5);
    expect(Math.abs(d.skew)).toBeLessThan(0.1);
  });
});

describe("spearmanTest", () => {
  it("is 1 for a monotonic (non-linear) relationship", () => {
    const t = spearmanTest([1, 2, 3, 4, 5, 6], [1, 4, 9, 16, 25, 36])!; // y = x^2, monotonic
    expect(t.r).toBeCloseTo(1, 5);
    expect(t.significant).toBe(true);
  });
});

describe("benjaminiHochberg", () => {
  it("controls the false discovery rate", () => {
    // One tiny p (real), rest large (noise) → only the tiny one survives.
    const keep = benjaminiHochberg([0.001, 0.4, 0.6, 0.8, 0.9], 0.05);
    expect(keep[0]).toBe(true);
    expect(keep.slice(1).some(Boolean)).toBe(false);
  });
});

describe("multipleRegression", () => {
  it("recovers coefficients of y = 1 + 2*x1 + 3*x2", () => {
    const x1 = [1, 2, 3, 4, 5, 6, 7, 8];
    const x2 = [2, 1, 4, 3, 6, 5, 8, 7];
    const y = x1.map((v, i) => 1 + 2 * v + 3 * x2[i]);
    const r = multipleRegression([x1, x2], y, ["x1", "x2"])!;
    expect(r.intercept).toBeCloseTo(1, 4);
    expect(r.coefficients[0].coef).toBeCloseTo(2, 4);
    expect(r.coefficients[1].coef).toBeCloseTo(3, 4);
    expect(r.r2).toBeCloseTo(1, 6);
  });
});
