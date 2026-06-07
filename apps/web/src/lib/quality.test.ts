import { describe, expect, it } from "vitest";
import { computeDataQuality } from "./quality";
import { profileTable } from "./profile";
import type { CleaningReport, Table } from "./types";

function salesTable(): Table {
  const rows = [
    { Date: "2023-01-01", Region: "North", Revenue: 100, Units: 10 },
    { Date: "2023-01-08", Region: "South", Revenue: 200, Units: 20 },
    { Date: "2023-01-15", Region: "North", Revenue: 300, Units: 30 },
    { Date: "2023-01-22", Region: "South", Revenue: 150, Units: 15 },
    { Date: "2023-01-29", Region: "North", Revenue: 200, Units: 22 },
    { Date: "2023-02-05", Region: "South", Revenue: 100, Units: 11 },
  ];
  return { name: "s.csv", columns: ["Date", "Region", "Revenue", "Units"], rows, rowCount: rows.length };
}

function emptyReport(rows: number): CleaningReport {
  return {
    rowsBefore: rows,
    rowsAfter: rows,
    duplicatesRemoved: 0,
    emptyRowsRemoved: 0,
    totalRowsRemoved: 0,
    cellsNormalized: 0,
    cellsTrimmed: 0,
    columns: [],
    steps: [],
    preview: { columns: [], rows: [] },
  };
}

describe("computeDataQuality", () => {
  it("scores a clean dataset highly with five checks", () => {
    const t = salesTable();
    const q = computeDataQuality(t, profileTable(t), emptyReport(6));
    expect(q.checks).toHaveLength(5);
    expect(q.score).toBeGreaterThanOrEqual(80);
    expect(["A", "B"]).toContain(q.grade);
    expect(q.summary).toContain("/100");
  });

  it("penalizes duplicates and missing values", () => {
    const t = salesTable();
    // 2 of the 6 Region cells blank → lower completeness; cleaner removed 3 of 9 source rows.
    t.rows[0].Region = "";
    t.rows[3].Region = "";
    const report = emptyReport(6);
    report.rowsBefore = 9;
    report.duplicatesRemoved = 3;
    const q = computeDataQuality(t, profileTable(t), report);
    const clean = computeDataQuality(salesTable(), profileTable(salesTable()), emptyReport(6));
    expect(q.score).toBeLessThan(clean.score);
    const uniqueness = q.checks.find((c) => c.id === "uniqueness")!;
    expect(uniqueness.status).not.toBe("good");
    expect(uniqueness.fix).toBeDefined();
  });

  it("keeps the score within 0..100 and grade valid", () => {
    const t = salesTable();
    const q = computeDataQuality(t, profileTable(t), emptyReport(6));
    expect(q.score).toBeGreaterThanOrEqual(0);
    expect(q.score).toBeLessThanOrEqual(100);
    expect(["A", "B", "C", "D", "F"]).toContain(q.grade);
  });
});
