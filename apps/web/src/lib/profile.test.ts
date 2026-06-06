import { describe, expect, it } from "vitest";
import { inferType, parseNumeric, profileTable } from "./profile";
import type { Table } from "./types";

describe("parseNumeric", () => {
  it("handles currency, separators, percent, and parenthesized negatives", () => {
    expect(parseNumeric("$1,200.50")).toBeCloseTo(1200.5);
    expect(parseNumeric("45%")).toBe(45);
    expect(parseNumeric("(450)")).toBe(-450);
    expect(parseNumeric("1,000")).toBe(1000);
  });

  it("returns NaN for non-numbers", () => {
    expect(Number.isNaN(parseNumeric("hello"))).toBe(true);
    expect(Number.isNaN(parseNumeric(""))).toBe(true);
  });
});

describe("inferType", () => {
  it("detects currency, date, integer, category", () => {
    expect(inferType("Revenue", ["$1,000", "$2,000", "$3,000"])).toBe("currency");
    expect(inferType("Date", ["2023-01-01", "2023-02-01", "2023-03-01"])).toBe("date");
    expect(inferType("Count", ["1", "2", "3", "4"])).toBe("integer");
    // Low-cardinality strings → category (needs distinct/total < 0.5).
    expect(inferType("Region", ["North", "South", "North", "South", "North", "South"])).toBe("category");
  });
});

describe("profileTable", () => {
  const table: Table = {
    name: "t.csv",
    columns: ["Date", "Region", "Revenue"],
    rows: [
      { Date: "2023-01-01", Region: "North", Revenue: "$100" },
      { Date: "2023-02-01", Region: "South", Revenue: "$200" },
      { Date: "2023-03-01", Region: "North", Revenue: "$300" },
      { Date: "2023-04-01", Region: "South", Revenue: "$100" },
      { Date: "2023-05-01", Region: "North", Revenue: "$200" },
      { Date: "2023-06-01", Region: "South", Revenue: "$300" },
    ],
    rowCount: 6,
  };

  it("assigns roles and computes numeric summaries", () => {
    const p = profileTable(table);
    const byName = Object.fromEntries(p.map((c) => [c.name, c]));
    expect(byName.Date.role).toBe("time");
    expect(byName.Region.role).toBe("dimension");
    expect(byName.Revenue.role).toBe("metric");
    expect(byName.Revenue.numeric?.sum).toBe(1200);
  });

  it("honors typeHints", () => {
    const p = profileTable(table, { Revenue: "currency" });
    expect(p.find((c) => c.name === "Revenue")?.type).toBe("currency");
  });
});
