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

  // A few customers carry most of revenue → the action plan should raise a concentration de-risk item.
  function concentratedRevenue(): Table {
    const weights = [50, 26, 13, 6, 3, 1, 1, 1, 1, 1]; // per-order revenue, heavily skewed to the first few
    const rows: Record<string, unknown>[] = [];
    const start = Date.UTC(2023, 0, 1);
    let i = 0;
    for (let c = 0; c < 10; c++) {
      const orders = c < 3 ? 6 : 2;
      for (let o = 0; o < orders; o++) {
        rows.push({
          Date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
          Customer: `C${c}`,
          Revenue: weights[c] * 100,
        });
        i++;
      }
    }
    return { name: "rev.csv", columns: ["Date", "Customer", "Revenue"], rows, rowCount: rows.length };
  }

  it("raises a measure-based concentration de-risk action when revenue is skewed", async () => {
    const spec = await analyze(concentratedRevenue(), { skipCharts: true });
    const conc = spec.actions!.find((a) => a.basis.toLowerCase().includes("concentration (pareto)"));
    expect(conc).toBeDefined();
    expect(conc!.title).toMatch(/de-risk/i);
    expect(conc!.detail).toMatch(/Gini/);
  });
});
