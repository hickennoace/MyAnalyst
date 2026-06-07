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

describe("multi-facet evidence (Phase 1.5)", () => {
  it("pre-computes the focal metric across multiple named dimensions", async () => {
    const { buildFocalFacts } = await import("./query");
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 30; i++) {
      rows.push({ Region: ["North", "South", "East"][i % 3], Product: ["A", "B"][i % 2], Revenue: 100 + i });
    }
    const t: Table = { name: "m.csv", columns: ["Region", "Product", "Revenue"], rows, rowCount: rows.length };
    const p = profileTable(t);
    const facts = buildFocalFacts("revenue by region and product", t, p) as {
      breakdowns?: { dimension: string; topGroups: { total: number }[] }[];
    };
    expect(facts.breakdowns).toBeDefined();
    expect(facts.breakdowns!.length).toBe(2);
    const dims = facts.breakdowns!.map((b) => b.dimension).sort();
    expect(dims).toEqual(["Product", "Region"]);
    for (const b of facts.breakdowns!) expect(b.topGroups[0].total).toBeGreaterThan(0);
  });
});

describe("comparison questions (Phase 1.2)", () => {
  it("compares a metric across two categorical values", () => {
    const r = answerQuestion("compare revenue for North vs South", table, profiles);
    expect(r.ok).toBe(true);
    // North total = 600, South total = 450.
    expect(r.answer).toContain("600");
    expect(r.answer).toContain("450");
    expect(r.answer).toContain("North"); // North is the higher side
    expect(r.answer.toLowerCase()).toContain("higher by");
    expect(r.chart?.type).toBe("bar");
  });

  it("honors average vs total in a comparison", () => {
    const r = answerQuestion("compare average revenue North vs South", table, profiles);
    expect(r.ok).toBe(true);
    // North avg = 600/3 = 200, South avg = 450/3 = 150.
    expect(r.answer).toContain("200");
    expect(r.answer).toContain("150");
    expect(r.answer.toLowerCase()).toContain("average");
  });

  it("does not hijack a two-metric correlation 'vs' question", () => {
    const r = answerQuestion("revenue vs units", table, profiles);
    expect(r.ok).toBe(true);
    // No dimension values / years named → falls through to correlation, not comparison.
    expect(r.answer.toLowerCase()).toContain("correlation");
    expect(r.chart?.type).toBe("scatter");
  });

  it("compares two years on the time column", () => {
    const rows = [
      { Date: "2022-01-01", Region: "North", Revenue: 100 },
      { Date: "2022-06-01", Region: "South", Revenue: 200 },
      { Date: "2023-01-01", Region: "North", Revenue: 300 },
      { Date: "2023-06-01", Region: "South", Revenue: 250 },
      { Date: "2023-09-01", Region: "North", Revenue: 150 },
      { Date: "2022-09-01", Region: "South", Revenue: 50 },
    ];
    const t: Table = { name: "y.csv", columns: ["Date", "Region", "Revenue"], rows, rowCount: rows.length };
    const p = profileTable(t);
    const r = answerQuestion("how does 2023 compare to 2022 for revenue", t, p);
    expect(r.ok).toBe(true);
    // 2023 total = 300+250+150 = 700; 2022 total = 100+200+50 = 350.
    expect(r.answer).toContain("700");
    expect(r.answer).toContain("350");
    expect(r.answer).toContain("2023");
  });

  it("detectComparison returns the dimension and slices", async () => {
    const { detectComparison } = await import("./query");
    const c = detectComparison("North vs South revenue", table, profiles);
    expect(c?.kind).toBe("category");
    expect(c?.column).toBe("Region");
    expect(c?.left.label).toBe("North");
    expect(c?.right.label).toBe("South");
  });
});

describe("show-the-math (Phase 1.4)", () => {
  it("explains how an aggregate was computed, including the row basis", () => {
    const r = answerQuestion("total revenue", table, profiles);
    expect(r.method).toBeDefined();
    expect(r.method!.toLowerCase()).toContain("revenue");
    expect(r.method).toContain("6 rows"); // full dataset
  });

  it("notes the filter and reduced row count in the method", () => {
    const r = answerQuestion("total revenue for North", table, profiles);
    expect(r.method).toBeDefined();
    expect(r.method).toContain("3 of 6 rows");
    expect(r.method).toContain("North");
  });

  it("describes a comparison's computation", () => {
    const r = answerQuestion("compare revenue North vs South", table, profiles);
    expect(r.method).toBeDefined();
    expect(r.method!.toLowerCase()).toContain("difference");
  });
});

describe("AI chart selection (Phase 1.3)", () => {
  it("accepts a well-formed chart request and keeps only real y columns", async () => {
    const { sanitizeChartRequest } = await import("./query");
    const req = sanitizeChartRequest(
      { type: "bar", x: "Region", y: ["Revenue", "Nonexistent"], aggregate: true },
      profiles
    );
    expect(req).toBeDefined();
    expect(req!.type).toBe("bar");
    expect(req!.x).toBe("Region");
    expect(req!.y).toEqual(["Revenue"]); // unknown column dropped
    expect(req!.aggregate).toBe(true);
  });

  it("rejects an unknown chart type", async () => {
    const { sanitizeChartRequest } = await import("./query");
    expect(sanitizeChartRequest({ type: "sankey", x: "Region", y: [] }, profiles)).toBeUndefined();
  });

  it("rejects an x column that isn't in the data", async () => {
    const { sanitizeChartRequest } = await import("./query");
    expect(sanitizeChartRequest({ type: "bar", x: "Made Up", y: ["Revenue"] }, profiles)).toBeUndefined();
  });

  it("rejects non-object input", async () => {
    const { sanitizeChartRequest } = await import("./query");
    expect(sanitizeChartRequest(null, profiles)).toBeUndefined();
    expect(sanitizeChartRequest("bar chart please", profiles)).toBeUndefined();
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
