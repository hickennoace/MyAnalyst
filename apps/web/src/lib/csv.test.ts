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
});
