import { describe, expect, it } from "vitest";
import { analyze } from "./analyze";
import type { Table } from "./types";

// Sales data with a deliberate, strong Region→Revenue gap (North runs much higher than South), so the
// action report should surface a quantified "close the gap" recommendation.
function gappedSales(): Table {
  const rows: Record<string, unknown>[] = [];
  const start = Date.UTC(2023, 0, 1);
  for (let i = 0; i < 60; i++) {
    const north = i % 2 === 0;
    rows.push({
      Date: new Date(start + i * 7 * 86400000).toISOString().slice(0, 10),
      Region: north ? "North" : "South",
      Spend: 400 + (i % 6) * 40,
      Revenue: north ? 1000 + (i % 5) * 30 : 300 + (i % 5) * 20,
    });
  }
  return { name: "sales.csv", columns: ["Date", "Region", "Spend", "Revenue"], rows, rowCount: rows.length };
}

describe("buildActionReport (via analyze)", () => {
  it("produces a ranked, grounded action plan", async () => {
    const spec = await analyze(gappedSales(), { skipCharts: true });
    expect(spec.actions).toBeDefined();
    expect(spec.actions!.length).toBeGreaterThan(0);
    expect(spec.actions!.length).toBeLessThanOrEqual(5);
    for (const a of spec.actions!) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.detail.length).toBeGreaterThan(0);
      expect(["high", "medium", "low"]).toContain(a.impact);
      expect(a.basis.length).toBeGreaterThan(0);
    }
    // The Region→Revenue gap should be flagged with an opportunity size.
    const gap = spec.actions!.find((a) => a.title.toLowerCase().includes("gap") || a.basis.toLowerCase().includes("anova"));
    expect(gap).toBeDefined();
    expect(gap!.detail).toMatch(/worth about/i);
  });
});
