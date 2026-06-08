import { describe, expect, it } from "vitest";
import { analyzeText, textColumns } from "./text-analytics";
import { profileTable } from "./profile";
import type { Table } from "./types";

function feedbackTable(): Table {
  // Distinct verbatims (real free text), with "customer service" recurring and a clear pos/neg split.
  const comments = [
    "The customer service was great and the staff were really friendly",
    "Terrible customer service, the staff were rude and the wait was slow",
    "Customer service helped me quickly, very happy with the experience",
    "Awful experience, slow service and a rude employee at the counter",
    "Friendly staff and excellent customer service, would recommend",
    "Disappointed with the slow service and the broken checkout system",
    "Customer service was helpful and the store was clean and pleasant",
    "Bad customer service, felt ignored and the process was confusing",
  ];
  const rows = comments.map((c, i) => ({ Id: i, Comment: c }));
  return { name: "f.csv", columns: ["Id", "Comment"], rows, rowCount: rows.length };
}

describe("textColumns", () => {
  it("detects a free-text column and ignores ids", () => {
    const t = feedbackTable();
    const cols = textColumns(t, profileTable(t)).map((c) => c.name);
    expect(cols).toContain("Comment");
    expect(cols).not.toContain("Id");
  });
});

describe("analyzeText", () => {
  it("extracts recurring phrases preferring bigrams", () => {
    const a = analyzeText(feedbackTable(), "Comment")!;
    expect(a.responseCount).toBe(8);
    expect(a.terms.some((t) => t.term === "customer service")).toBe(true);
  });

  it("separates positive and negative sentiment", () => {
    const a = analyzeText(feedbackTable(), "Comment")!;
    expect(a.sentiment).toBeDefined();
    expect(a.sentiment!.positive).toBeGreaterThan(0);
    expect(a.sentiment!.negative).toBeGreaterThan(0);
  });

  it("attaches a representative quote to a theme", () => {
    const a = analyzeText(feedbackTable(), "Comment")!;
    const term = a.terms.find((t) => t.term === "customer service");
    expect(term?.sample).toBeTruthy();
  });

  it("returns undefined for too few responses", () => {
    const rows = [{ Comment: "good service here" }];
    expect(analyzeText({ name: "x", columns: ["Comment"], rows, rowCount: 1 }, "Comment")).toBeUndefined();
  });
});
