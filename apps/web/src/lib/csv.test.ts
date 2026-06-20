import { describe, expect, it } from "vitest";
import { rowsToCsv } from "./csv";

describe("rowsToCsv", () => {
  it("emits a header row and one line per row, projecting only the given columns", () => {
    const csv = rowsToCsv(["a", "b"], [{ a: 1, b: 2, c: 99 }, { a: 3, b: 4 }]);
    expect(csv).toBe("a,b\r\n1,2\r\n3,4");
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    const csv = rowsToCsv(["name"], [{ name: 'Acme, Inc. "the best"' }]);
    expect(csv).toBe('name\r\n"Acme, Inc. ""the best"""');
  });

  it("renders missing/null cells as empty", () => {
    expect(rowsToCsv(["a", "b"], [{ a: null, b: undefined }])).toBe("a,b\r\n,");
  });

  it("neutralizes formula-injection cells with a leading quote", () => {
    // Values with no comma/quote/newline get only the ' prefix (no surrounding quotes).
    expect(rowsToCsv(["v"], [{ v: "+1+1" }, { v: "@SUM(A1)" }, { v: "-2+3" }])).toBe(
      "v\r\n'+1+1\r\n'@SUM(A1)\r\n'-2+3"
    );
    // A formula containing a quote is guarded AND CSV-quoted (inner quotes doubled).
    expect(rowsToCsv(["v"], [{ v: '=HYPERLINK("http://evil")' }])).toBe(
      'v\r\n"\'=HYPERLINK(""http://evil"")"'
    );
  });

  it("keeps genuine negative and positive numbers numeric (no quote prefix)", () => {
    expect(rowsToCsv(["n"], [{ n: -5.3 }, { n: "+10" }, { n: -42 }])).toBe("n\r\n-5.3\r\n+10\r\n-42");
  });
});
