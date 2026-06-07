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

  // ── Filtered & conditional questions (Phase 1.1) ──────────────────────────────

  it("filters an aggregate by a categorical value", () => {
    const r = answerQuestion("total revenue for the North region", table, profiles);
    expect(r.ok).toBe(true);
    // North rows: 100 + 300 + 200 = 600 (not the full 1,050).
    expect(r.answer).toContain("600");
    expect(r.answer).toContain("North");
    expect(r.answer).not.toContain("1,050");
  });

  it("filters a row count by a categorical value", () => {
    const r = answerQuestion("how many records for South", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toMatch(/\b3\b/); // 3 South rows
    expect(r.answer).toContain("South");
  });

  it("filters by year on the time column", () => {
    const r = answerQuestion("total revenue in 2023", table, profiles);
    expect(r.ok).toBe(true);
    // Only the Feb 2023? No — five rows are Jan 2023, one is Feb 2023; all 2023 → 1,050.
    expect(r.answer).toContain("1,050");
    expect(r.answer).toContain("2023");
    // A year with no rows yields a graceful miss.
    const none = answerQuestion("total revenue in 2019", table, profiles);
    expect(none.ok).toBe(false);
  });

  it("filters an aggregate by a numeric comparison on a named metric", () => {
    const r = answerQuestion("total revenue where revenue is over 150", table, profiles);
    expect(r.ok).toBe(true);
    // Revenue > 150: 200 + 300 + 200 = 700.
    expect(r.answer).toContain("700");
    expect(r.answer.toLowerCase()).toContain("over 150");
  });

  it("combines a filter with a group-by ranking", () => {
    const r = answerQuestion("average units by region in 2023", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("2023");
    expect(r.answer.toLowerCase()).toContain("units");
  });

  it("leaves unfiltered questions unchanged", () => {
    const r = answerQuestion("total revenue", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("1,050");
    expect(r.answer).not.toMatch(/in 20|for Region|where/);
  });
});

describe("detectFilter", () => {
  it("returns undefined when there is no condition", async () => {
    const { detectFilter } = await import("./query");
    expect(detectFilter("total revenue by region", table, profiles)).toBeUndefined();
  });

  it("detects a categorical value filter", async () => {
    const { detectFilter, applyFilter } = await import("./query");
    const f = detectFilter("revenue for North", table, profiles);
    expect(f?.column).toBe("Region");
    expect(applyFilter(table, f!).rowCount).toBe(3);
  });
});
