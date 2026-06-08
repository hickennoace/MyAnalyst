import { describe, expect, it } from "vitest";
import { goalSeek, predictTarget } from "./scenario";
import type { DriverModel } from "./types";

// target = 50 (mean) + 2·(adSpend − 10) + 5·(reps − 4)
const model: DriverModel = {
  intercept: 0,
  targetMean: 50,
  targetStd: 12,
  predictors: [
    { name: "adSpend", coef: 2, mean: 10, std: 3, min: 4, max: 16 },
    { name: "reps", coef: 5, mean: 4, std: 1, min: 2, max: 6 },
  ],
};

describe("predictTarget", () => {
  it("returns the target mean at baseline", () => {
    expect(predictTarget(model, {})).toBe(50);
    expect(predictTarget(model, { adSpend: 10, reps: 4 })).toBe(50);
  });

  it("applies each lever's coefficient from its mean", () => {
    expect(predictTarget(model, { adSpend: 12 })).toBe(54); // +2 units · coef 2
    expect(predictTarget(model, { adSpend: 12, reps: 5 })).toBe(59); // +4 from ad, +5 from reps
  });
});

describe("goalSeek", () => {
  it("solves each single lever to reach the target delta", () => {
    const s = goalSeek(model, 10); // want +10
    const ad = s.find((x) => x.name === "adSpend")!;
    const reps = s.find((x) => x.name === "reps")!;
    expect(ad.deltaX).toBeCloseTo(5, 6); // 10 / coef 2
    expect(ad.toValue).toBeCloseTo(15, 6);
    expect(reps.deltaX).toBeCloseTo(2, 6); // 10 / coef 5
  });

  it("ranks the most feasible (in-range, fewest SDs) lever first", () => {
    // +10: reps needs +2 (2 SD, in range), adSpend needs +5 (1.67 SD, in range) → adSpend is easier.
    const s = goalSeek(model, 10);
    expect(s[0].name).toBe("adSpend");
  });

  it("marks out-of-range moves", () => {
    const s = goalSeek(model, 100); // huge target; needs values far past observed range
    expect(s.every((x) => !x.withinRange)).toBe(true);
  });
});
