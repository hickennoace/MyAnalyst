import { describe, expect, it } from "vitest";
import { filenameFromUrl } from "./url-import";

describe("filenameFromUrl", () => {
  it("takes the last path segment", () => {
    expect(filenameFromUrl("https://example.com/data/sales.csv")).toBe("sales.csv");
    expect(filenameFromUrl("https://raw.githubusercontent.com/u/r/main/orders.tsv")).toBe("orders.tsv");
  });

  it("defaults to a .csv extension when none is present", () => {
    expect(filenameFromUrl("https://example.com/api/export")).toBe("export.csv");
    expect(filenameFromUrl("https://example.com/")).toBe("remote-data.csv");
  });

  it("ignores query strings and sanitizes odd characters", () => {
    expect(filenameFromUrl("https://example.com/path/q1%20report.csv?token=abc")).toBe("q1_report.csv");
  });

  it("falls back safely on an invalid URL", () => {
    expect(filenameFromUrl("not a url")).toBe("remote-data.csv");
  });
});
