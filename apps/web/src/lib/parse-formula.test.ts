import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { evalArithmetic, fillFormulaCells } from "./parse";

describe("evalArithmetic (safe, no eval — works under strict CSP)", () => {
  it("evaluates arithmetic with precedence and parentheses", () => {
    expect(evalArithmetic("11700*12+14000")).toBe(154400);
    expect(evalArithmetic("(10+5)/3")).toBe(5);
    expect(evalArithmetic("2+3*4")).toBe(14);
    expect(evalArithmetic("-5+10")).toBe(5);
  });
  it("rejects anything non-arithmetic", () => {
    expect(evalArithmetic("1+a")).toBeNull();
    expect(evalArithmetic("")).toBeNull();
  });
});

describe("fillFormulaCells — Excel derived columns saved without cached values", () => {
  it("computes a formula-stub cell from its dependencies (the Workers.xlsx bug)", () => {
    // Salary (G) and Bonus (H) are real; Total (I) is a formula stub (t:'z', v:0) like SheetJS emits.
    const ws: XLSX.WorkSheet = {
      "!ref": "G1:I2",
      G1: { t: "s", v: "Salary (monthly)" },
      H1: { t: "s", v: "Bonuses (annual)" },
      I1: { t: "s", v: "Total paid (year)" },
      G2: { t: "n", v: 11700 },
      H2: { t: "n", v: 14000 },
      I2: { t: "z", f: "G2*12+H2", v: 0, z: '#,##0" ₪"' },
    } as unknown as XLSX.WorkSheet;
    fillFormulaCells(ws);
    const cell = ws.I2 as XLSX.CellObject;
    expect(cell.t).toBe("n");
    expect(cell.v).toBe(154400); // 11700*12 + 14000
  });

  it("resolves a formula that references another formula cell (chained)", () => {
    const ws: XLSX.WorkSheet = {
      "!ref": "A1:C2",
      A2: { t: "n", v: 10 },
      B2: { t: "z", f: "A2*2", v: 0 },
      C2: { t: "z", f: "B2+1", v: 0 },
    } as unknown as XLSX.WorkSheet;
    fillFormulaCells(ws);
    expect((ws.B2 as XLSX.CellObject).v).toBe(20);
    expect((ws.C2 as XLSX.CellObject).v).toBe(21);
  });

  it("leaves unsupported formulas (functions/ranges) blank rather than guessing", () => {
    const ws: XLSX.WorkSheet = {
      "!ref": "A1:A2",
      A2: { t: "z", f: "SUM(B2:B9)", v: 0 },
    } as unknown as XLSX.WorkSheet;
    fillFormulaCells(ws);
    expect((ws.A2 as XLSX.CellObject).t).toBe("z"); // unchanged
  });
});
