import { describe, expect, it } from "vitest";
import { answerQuestion } from "./query";
import { profileTable } from "./profile";
import type { Table } from "./types";

function salesTable(): Table {
  // 6 rows so Region (2 distinct) is classified as a dimension (distinct/total < 0.5).
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

const table = salesTable();
const profiles = profileTable(table);

describe("answerQuestion", () => {
  it("answers a total aggregate", () => {
    const r = answerQuestion("total revenue", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("1,050");
  });

  it("ranks a dimension by a metric", () => {
    const r = answerQuestion("which region has the highest revenue", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("North"); // 100+300+200 = 600 > 200+150+100 = 450
    // Must be a revenue ranking (sum), NOT a count of regions.
    expect(r.answer).toMatch(/Revenue|600/);
    expect(r.chart?.type).toBe("bar");
  });

  it("computes a correlation with a scatter chart", () => {
    const r = answerQuestion("correlation between revenue and units", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer.toLowerCase()).toContain("correlation");
    expect(r.chart?.type).toBe("scatter");
  });

  it("counts rows", () => {
    const r = answerQuestion("how many records are there", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("6");
  });

  it("fails gracefully on nonsense", () => {
    const r = answerQuestion("what is the meaning of life", table, profiles);
    expect(r.ok).toBe(false);
  });
});
