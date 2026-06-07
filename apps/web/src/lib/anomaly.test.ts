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
});
