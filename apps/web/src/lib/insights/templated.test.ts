import { describe, expect, it } from "vitest";
import { TemplatedInsightProvider } from "./templated";
import type { CategoryFact, InsightContext } from "../types";

function ctxWith(category: CategoryFact): InsightContext {
  return {
    domain: "generic",
    rowCount: 101,
    columns: [],
    kpis: [],
    correlations: [],
    regression: undefined,
    trends: [],
    outliers: [],
    forecast: undefined,
    categories: [category],
    groupComparisons: [],
    associations: [],
    drivers: undefined,
    smallSample: false,
  };
}

async function catInsight(category: CategoryFact): Promise<string> {
  const insights = await new TemplatedInsightProvider().generate(ctxWith(category));
  return insights.find((i) => i.id.startsWith("ins-cat-"))!.text;
}

describe("templated categorical insight phrasing", () => {
  it("does not over-claim when the top two are essentially tied", async () => {
    const text = await catInsight({
      column: "Ticker",
      total: 101,
      distinct: 3,
      top: [
        { value: "ACME", count: 34, pct: 0.337 },
        { value: "GLOBEX", count: 34, pct: 0.337 },
      ],
    });
    expect(text).not.toContain("dominates");
    expect(text).not.toContain("distant second");
    expect(text).toContain("essentially tied");
    expect(text).toContain("the split itself is the story");
  });

  it("says 'dominates' and 'a distant second' only with a real gap", async () => {
    const text = await catInsight({
      column: "Reason",
      total: 100,
      distinct: 4,
      top: [
        { value: "Price", count: 70, pct: 0.7 },
        { value: "Timing", count: 20, pct: 0.2 },
      ],
    });
    expect(text).toContain("dominates");
    expect(text).toContain("a distant second");
    expect(text).toContain("action pays off first");
  });

  it("uses 'just ahead' for a modest lead", async () => {
    const text = await catInsight({
      column: "Channel",
      total: 100,
      distinct: 3,
      top: [
        { value: "Web", count: 45, pct: 0.45 },
        { value: "App", count: 38, pct: 0.38 },
      ],
    });
    expect(text).toContain("just ahead");
    expect(text).not.toContain("dominates");
    expect(text).not.toContain("distant second");
  });
});
