import { describe, expect, it } from "vitest";
import { redactForShare } from "./share";
import type { DashboardSpec } from "./types";

function spec(overrides: Partial<DashboardSpec> = {}): DashboardSpec {
  return {
    version: "1.0",
    datasetName: "feedback.csv",
    domain: { domain: "survey", confidence: 0.8, reason: "" },
    generatedAt: "2026-06-08T00:00:00.000Z",
    rowCount: 50,
    cleaning: { rowsBefore: 50, rowsAfter: 50, duplicatesRemoved: 0, emptyRowsRemoved: 0, totalRowsRemoved: 0, cellsNormalized: 0, cellsTrimmed: 0, columns: [], steps: [], preview: { columns: [], rows: [] } },
    profiles: [],
    kpis: [],
    charts: [],
    insights: [],
    conclusions: [],
    narrator: "templated",
    ...overrides,
  };
}

describe("redactForShare", () => {
  it("strips verbatim open-text quotes (possible PII) from the shared spec", () => {
    const s = spec({
      textAnalysis: [
        {
          column: "Comment",
          responseCount: 50,
          avgWords: 8,
          terms: [
            { term: "customer service", count: 12, share: 0.24, sample: "the customer service was rude to John Doe" },
            { term: "slow", count: 5, share: 0.1, sample: "everything was slow" },
          ],
          sentiment: { positive: 0.4, neutral: 0.2, negative: 0.4, score: 0 },
        },
      ],
    });
    const redacted = redactForShare(s);
    // Themes/counts (aggregate metadata) survive; the raw quotes are gone.
    expect(redacted.textAnalysis![0].terms.map((t) => t.term)).toEqual(["customer service", "slow"]);
    expect(redacted.textAnalysis![0].terms.every((t) => t.sample === undefined)).toBe(true);
    // The original spec is not mutated (live view keeps its quotes).
    expect(s.textAnalysis![0].terms[0].sample).toContain("John Doe");
  });

  it("is a no-op when there is no text analysis", () => {
    const s = spec();
    expect(redactForShare(s)).toBe(s);
  });
});
