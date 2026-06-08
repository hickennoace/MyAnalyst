import { describe, expect, it } from "vitest";
import { itemsToTable, type PositionedToken } from "./table-extract";

// Build positioned tokens for a 3-column grid. Rows are 20px apart (y decreasing down the page);
// columns sit at x = 0, 100, 200. Each token's width ≈ chars × 6px.
function grid(rows: string[][], { x = [0, 100, 200], rowGap = 20, top = 500 } = {}): PositionedToken[] {
  const tokens: PositionedToken[] = [];
  rows.forEach((cells, r) => {
    const y = top - r * rowGap;
    cells.forEach((text, c) => {
      // a multi-word cell becomes two tokens with a small (sub-column) gap
      const words = text.split(" ");
      let cx = x[c];
      for (const w of words) {
        tokens.push({ x: cx, y, str: w, width: w.length * 6 });
        cx += w.length * 6 + 4;
      }
    });
  });
  return tokens;
}

describe("itemsToTable", () => {
  it("reconstructs a clean 3-column table with the first row as header", () => {
    const t = itemsToTable(
      grid([
        ["Region", "Revenue", "Units"],
        ["North", "1200", "30"],
        ["South", "800", "21"],
        ["East", "1500", "40"],
      ]),
      "doc.pdf"
    );
    expect(t.columns).toEqual(["Region", "Revenue", "Units"]);
    expect(t.rowCount).toBe(3);
    expect(t.rows[0]).toMatchObject({ Region: "North", Revenue: "1200", Units: "30" });
  });

  it("keeps multi-word cells together within a column", () => {
    const t = itemsToTable(
      grid([
        ["Region", "Sales Rep"],
        ["North", "Jane Doe"],
        ["South", "John Roe"],
      ], { x: [0, 120] }),
      "doc.pdf"
    );
    expect(t.columns).toEqual(["Region", "Sales Rep"]);
    expect(t.rows[0]).toMatchObject({ Region: "North", "Sales Rep": "Jane Doe" });
  });

  it("throws when there is no table-like structure", () => {
    const tokens: PositionedToken[] = [
      { x: 0, y: 100, str: "just", width: 24 },
      { x: 30, y: 100, str: "a", width: 6 },
      { x: 40, y: 100, str: "sentence", width: 48 },
      { x: 0, y: 80, str: "of", width: 12 },
      { x: 16, y: 80, str: "prose", width: 30 },
    ];
    expect(() => itemsToTable(tokens, "x.pdf")).toThrow();
  });

  it("de-duplicates repeated header names", () => {
    const t = itemsToTable(
      grid([
        ["X", "X", "Y"],
        ["1", "2", "3"],
        ["4", "5", "6"],
      ]),
      "doc.pdf"
    );
    expect(new Set(t.columns).size).toBe(3); // all unique even though two headers were "X"
  });
});
