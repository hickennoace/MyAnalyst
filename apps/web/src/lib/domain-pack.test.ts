import { describe, expect, it } from "vitest";
import { domainSuggestions, domainFocus } from "./domain-pack";
import { profileTable } from "./profile";
import type { Domain, Table } from "./types";

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

describe("domain packs", () => {
  const profiles = profileTable(salesTable());

  it("builds suggestions grounded in real column names", () => {
    const s = domainSuggestions("sales-operational", profiles);
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(5);
    // every suggestion references a real column
    const names = profiles.map((p) => p.name);
    for (const q of s) expect(names.some((n) => q.includes(n))).toBe(true);
  });

  it("gives a focus line for every domain", () => {
    for (const d of ["financial-timeseries", "sales-operational", "marketing", "survey", "generic"] as Domain[]) {
      expect(domainFocus(d).length).toBeGreaterThan(10);
    }
  });

  it("never returns an empty list when metrics exist", () => {
    for (const d of ["financial-timeseries", "marketing", "survey", "generic"] as Domain[]) {
      expect(domainSuggestions(d, profiles).length).toBeGreaterThan(0);
    }
  });
});
