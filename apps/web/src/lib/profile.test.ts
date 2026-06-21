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

  it("parses a currency symbol AFTER the number (the reported Shekel bug)", () => {
    expect(parseNumeric("12,500 ₪")).toBe(12500);
    expect(parseNumeric("12500₪")).toBe(12500);
    expect(parseNumeric("100 €")).toBe(100);
    expect(parseNumeric("¥1,250,000")).toBe(1250000);
    expect(parseNumeric("(₪500)")).toBe(-500);
  });

  it("parses European decimal/thousands formats (the silent ~1000x bug)", () => {
    expect(parseNumeric("1.234,56")).toBeCloseTo(1234.56); // was misread as 1.234
    expect(parseNumeric("1.234.567,89")).toBeCloseTo(1234567.89);
    expect(parseNumeric("12,5")).toBeCloseTo(12.5);
    expect(parseNumeric("1.234.567")).toBe(1234567);
    expect(parseNumeric("€1.234,56")).toBeCloseTo(1234.56);
    // US forms still parse exactly as before (no regression).
    expect(parseNumeric("1,234.56")).toBeCloseTo(1234.56);
    expect(parseNumeric("1,234")).toBe(1234);
    expect(parseNumeric("12.5")).toBeCloseTo(12.5);
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

  it("types a trailing-symbol Shekel column as currency, not text (the reported bug)", () => {
    expect(inferType("Total paid (year)", ["12,500 ₪", "13,200 ₪", "11,800 ₪", "14,000 ₪", "12,900 ₪"])).toBe("currency");
  });

  it("types a plain salary column as currency via the header hint", () => {
    expect(inferType("Salary", ["12500", "13200", "11800", "14000"])).toBe("currency");
  });

  it("types a European-formatted numeric column as numeric, not text", () => {
    expect(["number", "currency", "integer"]).toContain(
      inferType("Measure", ["1.234,56", "2.500,00", "990,50", "12.000,00"])
    );
  });

  it("keeps a mostly-numeric column numeric despite scattered null markers", () => {
    expect(["number", "currency", "integer"]).toContain(
      inferType("Profit", ["100", "200", "N/A", "300", "-", "150", "NULL", "250"])
    );
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
