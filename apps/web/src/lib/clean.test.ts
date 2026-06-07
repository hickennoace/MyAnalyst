import { describe, expect, it } from "vitest";
import { cleanTable } from "./clean";
import type { Table } from "./types";

function messyTable(): Table {
  const rows = [
    { Date: "1/1/2023", Region: "  North ", Revenue: "$1,000", Units: "10" },
    { Date: "2023-01-08", Region: "South", Revenue: "$2,000", Units: "20" },
    { Date: "1/1/2023", Region: "  North ", Revenue: "$1,000", Units: "10" }, // exact duplicate
    { Date: "", Region: "", Revenue: "", Units: "" }, // empty row
    { Date: "", Region: "Total", Revenue: "$3,000", Units: "30" }, // total row
  ];
  return { name: "m.csv", columns: ["Date", "Region", "Revenue", "Units"], rows, rowCount: rows.length };
}

describe("cleanTable", () => {
  const { table, report, typeHints } = cleanTable(messyTable());

  it("removes duplicate, empty, and total rows", () => {
    expect(report.duplicatesRemoved).toBe(1);
    expect(report.emptyRowsRemoved).toBe(1);
    expect(report.totalRowsRemoved).toBe(1);
    expect(table.rowCount).toBe(2);
  });

  it("normalizes currency to numbers and unifies dates", () => {
    expect(table.rows[0].Revenue).toBe(1000);
    expect(table.rows[0].Date).toBe("2023-01-01"); // from 1/1/2023
    expect(report.cellsNormalized).toBeGreaterThan(0);
  });

  it("trims whitespace", () => {
    expect(table.rows[0].Region).toBe("North");
    expect(report.cellsTrimmed).toBeGreaterThan(0);
  });

  it("detects column types as hints", () => {
    expect(typeHints.Revenue).toBe("currency");
    expect(typeHints.Date).toBe("date");
  });

  it("produces a before/after preview", () => {
    expect(report.preview.rows.length).toBeGreaterThan(0);
    expect(report.preview.rows[0].changed.some(Boolean)).toBe(true);
  });

  it("honors user type overrides instead of auto-detection", () => {
    // Force "Units" (auto-detected integer) to be treated as plain text — the column controls path.
    const r = cleanTable(messyTable(), { Units: "text" });
    expect(r.typeHints.Units).toBe("text");
    expect(typeof r.table.rows[0].Units).toBe("string"); // not coerced to a number
    expect(r.typeHints.Revenue).toBe("currency"); // un-overridden columns still auto-detect
  });
});
