import { describe, expect, it } from "vitest";
import { validatePlan, executePlan } from "./query";
import { profileTable } from "./profile";
import type { Table } from "./types";

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

const table = salesTable();
const profiles = profileTable(table);

describe("validatePlan", () => {
  it("accepts a well-formed plan and normalizes column casing", () => {
    const plan = validatePlan({ intent: "groupRank", metric: "revenue", dimension: "region", direction: "top" }, profiles)!;
    expect(plan).toBeDefined();
    expect(plan.metric).toBe("Revenue");
    expect(plan.dimension).toBe("Region");
    expect(plan.direction).toBe("top");
  });

  it("rejects an unknown intent and unknown columns", () => {
    expect(validatePlan({ intent: "frobnicate" }, profiles)).toBeUndefined();
    const plan = validatePlan({ intent: "aggregate", metric: "Nope" }, profiles)!;
    expect(plan.metric).toBeNull();
  });

  it("parses a filter and drops an invalid aggregator", () => {
    const plan = validatePlan({ intent: "aggregate", metric: "Revenue", agg: "bogus", filter: { column: "Region", op: "eq", value: "North" } }, profiles)!;
    expect(plan.agg).toBeNull();
    expect(plan.filter).toEqual({ column: "Region", op: "eq", value: "North", value2: null });
  });
});

describe("executePlan", () => {
  it("ranks a dimension by a metric", () => {
    const r = executePlan({ intent: "groupRank", metric: "Revenue", dimension: "Region", direction: "top" }, table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("North"); // 600 > 450
    expect(r.answer).toContain("600");
    expect(r.chart?.type).toBe("bar");
  });

  it("aggregates with a categorical filter (scoped, not whole dataset)", () => {
    const r = executePlan({ intent: "aggregate", metric: "Revenue", agg: "sum", filter: { column: "Region", op: "eq", value: "North" } }, table, profiles);
    expect(r.answer).toContain("600");
    expect(r.answer).not.toContain("1,050");
  });

  it("compares two values of a dimension", () => {
    const r = executePlan({ intent: "compare", metric: "Revenue", dimension: "Region", compareValues: ["North", "South"] }, table, profiles);
    expect(r.answer).toContain("600");
    expect(r.answer).toContain("450");
    expect(r.chart?.type).toBe("bar");
  });

  it("counts rows under a numeric filter", () => {
    const r = executePlan({ intent: "count", filter: { column: "Revenue", op: "gt", value: 150 } }, table, profiles);
    expect(r.answer).toMatch(/\b3\b/); // Revenue > 150 → 200, 300, 200
  });

  it("computes a correlation with a scatter chart", () => {
    const r = executePlan({ intent: "correlation", metric: "Revenue", metric2: "Units" }, table, profiles);
    expect(r.answer.toLowerCase()).toContain("correlation");
    expect(r.chart?.type).toBe("scatter");
  });

  it("returns ok:false for 'describe' so the narrator can use the overview", () => {
    expect(executePlan({ intent: "describe" }, table, profiles).ok).toBe(false);
  });
});
