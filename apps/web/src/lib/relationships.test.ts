import { describe, expect, it } from "vitest";
import { buildRelationships } from "./relationships";
import { profileTable } from "./profile";
import type { Table } from "./types";

// X drives Y (Y = 2X + noise) → strong positive; W moves opposite to X → strong negative.
function table(): Table {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < 40; i++) {
    const x = i;
    rows.push({ X: x, Y: 2 * x + (i % 3), W: 100 - x, Noise: (i * 7) % 11 });
  }
  return { name: "r.csv", columns: ["X", "Y", "W", "Noise"], rows, rowCount: rows.length };
}

describe("buildRelationships", () => {
  it("returns a symmetric matrix with a unit diagonal", () => {
    const m = buildRelationships(table(), profileTable(table()))!;
    expect(m).toBeDefined();
    const n = m.columns.length;
    for (let i = 0; i < n; i++) {
      expect(m.matrix[i][i]).toBe(1);
      for (let j = 0; j < n; j++) expect(m.matrix[i][j]).toBeCloseTo(m.matrix[j][i], 9);
    }
  });

  it("captures direction and strength of the strongest pair first", () => {
    const m = buildRelationships(table(), profileTable(table()))!;
    const top = m.pairs[0];
    expect(Math.abs(top.r)).toBeGreaterThan(0.9);
    expect(top.strength).toBe("strong");
    const xw = m.pairs.find((p) => (p.a === "X" && p.b === "W") || (p.a === "W" && p.b === "X"))!;
    expect(xw.r).toBeLessThan(-0.9); // X and W move in opposite directions
  });

  it("flags a derived/duplicate column as redundant", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ Sales: i + 1, Tax: (i + 1) * 0.1, Other: (i * 3) % 5 }));
    const t: Table = { name: "d.csv", columns: ["Sales", "Tax", "Other"], rows, rowCount: rows.length };
    const m = buildRelationships(t, profileTable(t))!;
    const salesTax = m.pairs.find((p) => [p.a, p.b].includes("Sales") && [p.a, p.b].includes("Tax"))!;
    expect(salesTax.redundant).toBe(true); // Tax = Sales × 0.1 → r ≈ 1
  });

  it("returns undefined with fewer than two numeric columns", () => {
    const t: Table = { name: "s.csv", columns: ["Only"], rows: [{ Only: 1 }, { Only: 2 }, { Only: 3 }, { Only: 4 }], rowCount: 4 };
    expect(buildRelationships(t, profileTable(t))).toBeUndefined();
  });
});
