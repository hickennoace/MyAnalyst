import { describe, expect, it } from "vitest";
import { compareDatasets } from "./compare-datasets";
import type { Table } from "./types";

const mk = (name: string, revenues: number[]): Table => ({
  name,
  columns: ["Region", "Revenue"],
  rows: revenues.map((r, i) => ({ Region: i % 2 ? "North" : "South", Revenue: r })),
  rowCount: revenues.length,
});

describe("compareDatasets", () => {
  it("ranks shared numeric metrics by the size of the change", () => {
    const a = mk("jan.csv", [100, 100, 100, 100]); // sum 400
    const b = mk("feb.csv", [150, 150, 150, 150]); // sum 600 → +50%
    const c = compareDatasets(a, b);
    expect(c.metrics).toHaveLength(1);
    const rev = c.metrics[0];
    expect(rev.metric).toBe("Revenue");
    expect(rev.sumA).toBe(400);
    expect(rev.sumB).toBe(600);
    expect(rev.sumDeltaPct).toBeCloseTo(50, 5);
    expect(rev.meanDeltaPct).toBeCloseTo(50, 5);
  });

  it("reports row-count change and columns unique to each side", () => {
    const a: Table = { name: "a", columns: ["Region", "Revenue", "Units"], rows: [{ Region: "N", Revenue: 10, Units: 1 }], rowCount: 1 };
    const b: Table = { name: "b", columns: ["Region", "Revenue", "Spend"], rows: [{ Region: "N", Revenue: 20, Spend: 5 }, { Region: "S", Revenue: 30, Spend: 7 }], rowCount: 2 };
    const c = compareDatasets(a, b);
    expect(c.rowsA).toBe(1);
    expect(c.rowsB).toBe(2);
    expect(c.rowDeltaPct).toBeCloseTo(100, 5);
    expect(c.onlyInA).toContain("Units");
    expect(c.onlyInB).toContain("Spend");
  });
});
