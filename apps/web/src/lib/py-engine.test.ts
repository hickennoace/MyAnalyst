import { describe, it, expect } from "vitest";
import { sampleForPayload } from "./py-engine";

const MAX = 3_800_000;

function rows(n: number, cols: string[], wide = false): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => {
    const r: Record<string, unknown> = {};
    for (const c of cols) r[c] = wide ? `${c}-value-${i}-padding-padding-padding` : i % 1000;
    return r;
  });
}

describe("sampleForPayload (adaptive byte-budget sampling)", () => {
  it("sends all rows when the dataset is small", () => {
    const out = sampleForPayload(["a", "b"], rows(5_000, ["a", "b"]));
    expect(out.length).toBe(5_000);
  });

  it("sends far more than the old 40k cap for a narrow table that fits", () => {
    const out = sampleForPayload(["a", "b"], rows(500_000, ["a", "b"]));
    expect(out.length).toBeGreaterThan(40_000); // adaptive — narrow rows fit many
    expect(out.length).toBeLessThanOrEqual(100_000); // bounded by the hard cap
    expect(JSON.stringify(out).length).toBeLessThan(MAX); // stays under the Vercel budget
  });

  it("keeps a wide table's payload under the Vercel limit (no 413)", () => {
    const cols = Array.from({ length: 30 }, (_, i) => `col${i}`);
    const out = sampleForPayload(cols, rows(200_000, cols, true));
    expect(JSON.stringify({ columns: cols, rows: out }).length).toBeLessThan(4_500_000);
    expect(out.length).toBeGreaterThan(0);
  });

  it("preserves column order in the emitted arrays", () => {
    const out = sampleForPayload(["x", "y", "z"], [{ z: 3, x: 1, y: 2 }]);
    expect(out[0]).toEqual([1, 2, 3]);
  });
});
