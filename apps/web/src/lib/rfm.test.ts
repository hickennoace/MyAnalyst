import { describe, expect, it } from "vitest";
import { analyzeRfm } from "./rfm";
import { profileTable } from "./profile";
import type { Table } from "./types";

// 12 customers. The first few are recent + frequent + high-spend (Champions); the last few bought once,
// long ago, for little (Hibernating). Several transactions per customer so the column recurs.
function transactions(): Table {
  const rows: Record<string, unknown>[] = [];
  const asOf = new Date("2024-06-01");
  for (let c = 0; c < 12; c++) {
    const champion = c < 4;
    const txns = champion ? 6 : 1;
    for (let t = 0; t < txns; t++) {
      // Champions transacted recently; laggards only long ago.
      const daysAgo = champion ? t * 5 : 300 + c * 5;
      const d = new Date(asOf.getTime() - daysAgo * 86_400_000);
      rows.push({
        CustomerID: `C${c}`,
        Date: d.toISOString().slice(0, 10),
        Amount: champion ? 500 : 20,
      });
    }
  }
  return { name: "tx.csv", columns: ["CustomerID", "Date", "Amount"], rows, rowCount: rows.length };
}

describe("analyzeRfm", () => {
  it("identifies the columns and segments the customers", () => {
    const t = transactions();
    const rfm = analyzeRfm(t, profileTable(t))!;
    expect(rfm).toBeDefined();
    expect(rfm.entity).toBe("CustomerID");
    expect(rfm.dateColumn).toBe("Date");
    expect(rfm.valueColumn).toBe("Amount");
    expect(rfm.customers).toBe(12);
    // Every customer lands in exactly one segment.
    expect(rfm.segments.reduce((s, g) => s + g.size, 0)).toBe(12);
  });

  it("puts the recent, frequent, high-spend cohort in Champions and ranks it top by value", () => {
    const t = transactions();
    const rfm = analyzeRfm(t, profileTable(t))!;
    const champ = rfm.segments.find((s) => s.key === "champions")!;
    expect(champ).toBeDefined();
    expect(champ.size).toBe(4);
    expect(champ.avgFrequency).toBeCloseTo(6, 6);
    // Champions hold the lion's share of revenue → first when sorted by total value.
    expect(rfm.segments[0].key).toBe("champions");
    expect(champ.monetaryShare).toBeGreaterThan(0.8);
  });

  it("returns undefined without an entity/date/value triple", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ Region: `R${i % 4}`, Sales: 100 + i }));
    const t: Table = { name: "flat.csv", columns: ["Region", "Sales"], rows, rowCount: rows.length };
    expect(analyzeRfm(t, profileTable(t))).toBeUndefined();
  });

  it("returns undefined with too few customers", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ CustomerID: `C${i}`, Date: "2024-01-01", Amount: 10 }));
    const t: Table = { name: "few.csv", columns: ["CustomerID", "Date", "Amount"], rows, rowCount: rows.length };
    expect(analyzeRfm(t, profileTable(t))).toBeUndefined();
  });
});
