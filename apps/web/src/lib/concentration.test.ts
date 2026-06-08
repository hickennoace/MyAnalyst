import { describe, expect, it } from "vitest";
import { analyzeConcentration, concentrationFor, concentrationMembers, gini } from "./concentration";
import { profileTable } from "./profile";
import type { Table } from "./types";

describe("gini", () => {
  it("is 0 for a perfectly even distribution", () => {
    expect(gini([10, 10, 10, 10])).toBeCloseTo(0, 6);
  });

  it("matches the closed-form value for a known skew", () => {
    // values [5,10,15,20,50]: Σ(2i−n−1)x_i = 200, n·Σx = 5·100 = 500 → 0.4
    expect(gini([50, 20, 15, 10, 5])).toBeCloseTo(0.4, 6);
  });

  it("approaches 1 as one value dominates", () => {
    expect(gini([1000, 1, 1, 1, 1])).toBeGreaterThan(0.75);
  });

  it("handles empty / all-zero without NaN", () => {
    expect(gini([])).toBe(0);
    expect(gini([0, 0, 0])).toBe(0);
  });
});

// Revenue is heavily concentrated: 5 products, the top 3 hold 85% of the total.
//   A 50, B 20, C 15, D 10, E 5  (per-row values repeated so each product has several rows).
function skewedTable(): Table {
  const per: Record<string, number> = { A: 50, B: 20, C: 15, D: 10, E: 5 };
  const rows: Record<string, unknown>[] = [];
  for (const [product, total] of Object.entries(per)) {
    for (let i = 0; i < 4; i++) rows.push({ Product: product, Revenue: total / 4 });
  }
  return { name: "sales.csv", columns: ["Product", "Revenue"], rows, rowCount: rows.length };
}

describe("analyzeConcentration", () => {
  it("computes the Pareto point, top share, and concentration indices", () => {
    const t = skewedTable();
    const [c] = analyzeConcentration(t, profileTable(t));
    expect(c).toBeDefined();
    expect(c.dimension).toBe("Product");
    expect(c.metric).toBe("Revenue");
    expect(c.metricIsCount).toBe(false);
    expect(c.total).toBeCloseTo(100, 6);
    expect(c.distinct).toBe(5);
    expect(c.topShare).toBeCloseTo(0.5, 6);
    // cumulative .5,.7,.85 → 3 products reach 80%.
    expect(c.paretoCount).toBe(3);
    expect(c.paretoShare).toBeCloseTo(0.85, 6);
    expect(c.gini).toBeCloseTo(0.4, 6);
    expect(c.hhi).toBeCloseTo(0.325, 6);
  });

  it("ranks segments largest-first with correct cumulative shares", () => {
    const t = skewedTable();
    const [c] = analyzeConcentration(t, profileTable(t));
    expect(c.segments.map((s) => s.name)).toEqual(["A", "B", "C", "D", "E"]);
    expect(c.segments[0].share).toBeCloseTo(0.5, 6);
    expect(c.segments.at(-1)!.cumShare).toBeCloseTo(1, 6);
  });

  it("rolls a long tail into an 'Other' row", () => {
    const rows: Record<string, unknown>[] = [];
    // One dominant category plus 20 tiny ones → more than TOP_KEEP categories.
    rows.push(...Array.from({ length: 30 }, () => ({ Cat: "BIG", Amt: 100 })));
    for (let i = 0; i < 20; i++) rows.push({ Cat: `c${i}`, Amt: 1 });
    const t: Table = { name: "t.csv", columns: ["Cat", "Amt"], rows, rowCount: rows.length };
    const [c] = analyzeConcentration(t, profileTable(t));
    expect(c).toBeDefined();
    const other = c.segments.find((s) => s.isOther);
    expect(other).toBeDefined();
    expect(c.level).toBe("high");
  });

  it("returns nothing for an evenly-spread measure", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ Region: `R${i % 8}`, Sales: 100 }));
    const t: Table = { name: "even.csv", columns: ["Region", "Sales"], rows, rowCount: rows.length };
    expect(analyzeConcentration(t, profileTable(t))).toHaveLength(0);
  });
});

describe("concentrationMembers", () => {
  it("returns the vital-few categories that reach the Pareto point, ranked with cumulative share", () => {
    const t = skewedTable();
    const [c] = analyzeConcentration(t, profileTable(t));
    const members = concentrationMembers(t, c);
    // paretoCount is 3 (A,B,C reach 85%).
    expect(members.map((m) => m.name)).toEqual(["A", "B", "C"]);
    expect(members.map((m) => m.rank)).toEqual([1, 2, 3]);
    expect(members[0].value).toBeCloseTo(50, 6);
    expect(members[0].share).toBeCloseTo(0.5, 6);
    expect(members.at(-1)!.cumShare).toBeCloseTo(0.85, 6);
  });

  it("recovers vital-few categories beyond the displayed top-8 (past the 'Other' roll-up)", () => {
    // 12 roughly-equal categories carry the total; reaching 80% takes ~10 of them — past the top-8
    // shown individually, so the members must come from a fresh re-derivation, not the summary rows.
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 12; i++) rows.push({ Cat: `M${i}`, Amt: 100 - i });
    const t: Table = { name: "t.csv", columns: ["Cat", "Amt"], rows, rowCount: rows.length };
    const c = concentrationFor(t, "Cat", { name: "Amt", values: rows.map((r) => r.Amt as number) })!;
    expect(c.segments.filter((s) => !s.isOther).length).toBeLessThanOrEqual(8); // summary rolled the tail up
    const members = concentrationMembers(t, c);
    expect(members).toHaveLength(c.paretoCount);
    expect(members.length).toBeGreaterThan(8); // proves we re-derived past the rolled-up tail
    expect(members.at(-1)!.cumShare).toBeGreaterThanOrEqual(0.8 - 1e-9);
  });
});
