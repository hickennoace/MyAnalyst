import { describe, expect, it } from "vitest";
import { profileTable } from "./profile";
import { aggregateCount, buildChart } from "./charts";
import { answerQuestion } from "./query";
import { deriveConclusions } from "./conclusions";
import type { InsightContext, Table } from "./types";

function nonBuyers(): Table {
  const reasons = [
    ...Array(10).fill("Price too high"),
    ...Array(6).fill("Found a better deal"),
    ...Array(4).fill("Not interested"),
  ];
  const rows = reasons.map((Reason, i) => ({ CustomerID: 1000 + i, Reason }));
  return { name: "non-buyers.csv", columns: ["CustomerID", "Reason"], rows, rowCount: rows.length };
}

const table = nonBuyers();
const profiles = profileTable(table);

describe("categorical analysis (any column type)", () => {
  it("aggregateCount tallies string values", () => {
    const pairs = aggregateCount(table, "Reason");
    expect(pairs[0]).toEqual(["Price too high", 10]);
    expect(pairs.length).toBe(3);
  });

  it("buildChart count mode works without a metric", () => {
    const spec = buildChart(table, profiles, { type: "bar", x: "Reason", y: [], count: true });
    expect(spec.type).toBe("bar");
    const series = (spec.option as { series: { data: number[] }[] }).series[0];
    expect(series.data[0]).toBe(10); // most common first
  });

  it("answers 'most common reason' with the top value + a chart", () => {
    const r = answerQuestion("which reason is most common for not buying", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("Price too high");
    expect(r.chart?.type).toBe("bar");
  });
});

describe("deriveConclusions", () => {
  const ctx: InsightContext = {
    domain: "generic",
    rowCount: 20,
    columns: [],
    kpis: [],
    correlations: [],
    trends: [],
    outliers: [],
    groupComparisons: [],
    associations: [],
    smallSample: false,
    categories: [
      {
        column: "Reason",
        total: 20,
        distinct: 3,
        top: [
          { value: "Price too high", count: 10, pct: 0.5 },
          { value: "Found a better deal", count: 6, pct: 0.3 },
          { value: "Not interested", count: 4, pct: 0.2 },
        ],
      },
    ],
  };

  it("turns a dominant category into an actionable conclusion", () => {
    const conclusions = deriveConclusions(ctx);
    expect(conclusions.length).toBeGreaterThan(0);
    expect(conclusions[0].text).toContain("Price too high");
    expect(conclusions[0].basis).toContain("Reason");
  });
});
