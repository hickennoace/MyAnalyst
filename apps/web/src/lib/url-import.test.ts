import { describe, expect, it } from "vitest";
import { filenameFromUrl, normalizeSourceUrl } from "./url-import";

describe("normalizeSourceUrl", () => {
  it("rewrites a Google Sheets edit URL to its CSV export endpoint", () => {
    const out = normalizeSourceUrl("https://docs.google.com/spreadsheets/d/ABC123_xyz/edit#gid=456");
    expect(out).toBe("https://docs.google.com/spreadsheets/d/ABC123_xyz/export?format=csv&gid=456");
  });

  it("defaults gid to 0 when absent", () => {
    expect(normalizeSourceUrl("https://docs.google.com/spreadsheets/d/ID9/edit")).toBe("https://docs.google.com/spreadsheets/d/ID9/export?format=csv&gid=0");
  });

  it("passes non-Sheets URLs through unchanged", () => {
    expect(normalizeSourceUrl("https://example.com/data.csv")).toBe("https://example.com/data.csv");
    expect(normalizeSourceUrl("not a url")).toBe("not a url");
  });
});

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
