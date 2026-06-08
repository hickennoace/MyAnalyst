import { describe, expect, it } from "vitest";
import { combinedContext, industryContext, INDUSTRY_TAGS } from "./industry-tags";
import { detectDomain } from "./domain";
import type { ColumnProfile } from "./types";

describe("industryContext / combinedContext", () => {
  it("returns the phrase for a known key and empty for none", () => {
    expect(industryContext("saas")).toMatch(/SaaS/i);
    expect(industryContext(null)).toBe("");
    expect(industryContext("nope")).toBe("");
  });

  it("merges the industry phrase with the user's free text", () => {
    expect(combinedContext("retail", "why are sales down?")).toMatch(/retail sales data.*why are sales down/i);
    expect(combinedContext(null, "")).toBeUndefined();
    expect(combinedContext(null, "just my note")).toBe("just my note");
  });
});

describe("industry tag biases domain detection", () => {
  // A deliberately ambiguous table (generic numeric column) — no domain keywords in the columns.
  const profiles: ColumnProfile[] = [
    { name: "Item", type: "category", fillRate: 1, distinctCount: 20, cardinalityRatio: 0.5, samples: [], role: "dimension" },
    { name: "Value", type: "number", fillRate: 1, distinctCount: 50, cardinalityRatio: 0.9, samples: [], role: "metric" },
  ];

  it("is generic with no context but shifts toward the tagged domain", () => {
    expect(detectDomain(profiles).domain).toBe("generic");
    const ctx = combinedContext("marketing", "");
    expect(detectDomain(profiles, ctx).domain).toBe("marketing");
  });

  it("every tag carries a non-empty context phrase", () => {
    for (const t of INDUSTRY_TAGS) expect(t.context.length).toBeGreaterThan(10);
  });
});
