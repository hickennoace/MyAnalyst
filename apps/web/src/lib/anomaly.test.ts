import { describe, expect, it } from "vitest";
import { detectAnomalies } from "./analyze";
import { profileTable } from "./profile";
import type { Table } from "./types";

describe("detectAnomalies", () => {
  it("flags a metric with an extreme value", () => {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 20; i++) rows.push({ Region: i % 2 ? "North" : "South", Amount: 100 + (i % 5) });
    rows.push({ Region: "North", Amount: 100000 }); // a glaring outlier
    const t: Table = { name: "a.csv", columns: ["Region", "Amount"], rows, rowCount: rows.length };
    const anomalies = detectAnomalies(t, profileTable(t));
    const amount = anomalies.find((a) => a.column === "Amount");
    expect(amount).toBeDefined();
    expect(amount!.count).toBeGreaterThanOrEqual(1);
    expect(amount!.examples[0].value).toBe(100000);
    expect(Math.abs(amount!.examples[0].z)).toBeGreaterThan(3);
  });

  it("returns nothing for a tidy column", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ Region: i % 2 ? "A" : "B", Amount: 100 + i }));
    const t: Table = { name: "b.csv", columns: ["Region", "Amount"], rows, rowCount: rows.length };
    expect(detectAnomalies(t, profileTable(t)).length).toBe(0);
  });

  it("attributes anomalies to the segment they cluster in", () => {
    const rows: Record<string, unknown>[] = [];
    // 60 tidy rows split across three stores...
    for (let i = 0; i < 60; i++) rows.push({ Store: ["A", "B", "C"][i % 3], Sales: 100 + (i % 7) });
    // ...then a burst of extreme values, all from store C.
    for (let i = 0; i < 5; i++) rows.push({ Store: "C", Sales: 5000 + i });
    const t: Table = { name: "c.csv", columns: ["Store", "Sales"], rows, rowCount: rows.length };
    const sales = detectAnomalies(t, profileTable(t)).find((a) => a.column === "Sales")!;
    expect(sales.breakdown).toBeDefined();
    expect(sales.breakdown![0].dimension).toBe("Store");
    expect(sales.breakdown![0].value).toBe("C");
    expect(sales.breakdown![0].lift).toBeGreaterThan(1); // over-represented vs its base rate
  });
});
