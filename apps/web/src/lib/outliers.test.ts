import { describe, expect, it } from "vitest";
import { analyzeColumnOutliers } from "./outliers";

describe("analyzeColumnOutliers", () => {
  it("classifies a right-skewed price tail as a SEGMENT, not anomalies", () => {
    // 150 mass-market prices ~24k + 8 luxury ~110k → a real (small) premium tail, not errors.
    const xs = [
      ...Array.from({ length: 150 }, (_, i) => 24000 + (i % 7) * 300),
      ...Array.from({ length: 8 }, (_, i) => 108000 + (i % 5) * 1000),
    ];
    const a = analyzeColumnOutliers("Price", xs)!;
    expect(a).toBeDefined();
    expect(a.kind).toBe("skew");
    expect(a.direction).toBe("high");
    expect(a.skew).toBeGreaterThan(1);
    expect(a.median).toBeLessThan(a.mean); // right-skew: mean pulled above the median
  });

  it("flags a couple of isolated points in an otherwise normal column as ANOMALIES", () => {
    const xs = [...Array.from({ length: 60 }, (_, i) => 50 + (i % 11) - 5), 9000, -8000];
    const a = analyzeColumnOutliers("Reading", xs)!;
    expect(a.kind).toBe("anomaly");
    expect(a.count).toBe(2);
    expect(a.direction).toBe("both");
  });

  it("returns undefined when there's no spread or too little data", () => {
    expect(analyzeColumnOutliers("Flat", Array(20).fill(5))).toBeUndefined();
    expect(analyzeColumnOutliers("Tiny", [1, 2, 3])).toBeUndefined();
  });

  it("returns undefined when nothing is extreme", () => {
    const xs = Array.from({ length: 50 }, (_, i) => 100 + (i % 10));
    expect(analyzeColumnOutliers("Even", xs)).toBeUndefined();
  });
});
