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

describe("cleanTable — textual null markers", () => {
  it("treats N/A / NULL / '-' as missing (type-aware), keeping real numbers", () => {
    const t: Table = {
      name: "n.csv",
      columns: ["Region", "Profit"],
      rows: [
        { Region: "North", Profit: "100" },
        { Region: "N/A", Profit: "200" }, // null region, value present → row kept
        { Region: "South", Profit: "-" }, // null profit (numeric col), region present → row kept
        { Region: "West", Profit: "300" },
      ],
      rowCount: 4,
    };
    const { table } = cleanTable(t);
    expect(table.rowCount).toBe(4);
    expect(table.rows[1].Region).toBeNull();
    expect(table.rows[1].Profit).toBe(200);
    expect(table.rows[2].Profit).toBeNull();
    // The sentinels never become a category value.
    expect(table.rows.map((r) => r.Region)).not.toContain("N/A");
  });
});

describe("cleanTable — day-first dates", () => {
  it("reads DD/MM/YYYY when a day value over 12 reveals the order", () => {
    const t: Table = {
      name: "d.csv",
      columns: ["Date", "V"],
      rows: [
        { Date: "13/06/2026", V: "1" }, // 13 can only be a day → day-first column
        { Date: "06/07/2026", V: "2" }, // → 6 July, not 7 June
        { Date: "21/12/2026", V: "3" },
        { Date: "01/01/2026", V: "4" },
      ],
      rowCount: 4,
    };
    const { table, report } = cleanTable(t);
    expect(table.rows[0].Date).toBe("2026-06-13");
    expect(table.rows[1].Date).toBe("2026-07-06");
    expect(report.steps.some((s) => s.label.toLowerCase().includes("day-first"))).toBe(true);
  });

  it("keeps the US month-first default when nothing disambiguates", () => {
    const t: Table = {
      name: "u.csv",
      columns: ["Date", "V"],
      rows: [
        { Date: "01/02/2026", V: "1" },
        { Date: "03/04/2026", V: "2" },
        { Date: "05/06/2026", V: "3" },
      ],
      rowCount: 3,
    };
    const { table } = cleanTable(t);
    expect(table.rows[0].Date).toBe("2026-01-02"); // month-first (2 Jan), unchanged behavior
  });
});
