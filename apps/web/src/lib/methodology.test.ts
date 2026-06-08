import { describe, expect, it } from "vitest";
import { buildMethodology, buildRecipe, fingerprint } from "./methodology";
import type { DashboardSpec } from "./types";

function spec(overrides: Partial<DashboardSpec> = {}): DashboardSpec {
  return {
    version: "1.0",
    datasetName: "sales.csv",
    domain: { domain: "sales-operational", confidence: 0.8, reason: "" },
    generatedAt: "2026-06-08T00:00:00.000Z",
    rowCount: 500,
    cleaning: { rowsBefore: 510, rowsAfter: 500, duplicatesRemoved: 5, emptyRowsRemoved: 5, totalRowsRemoved: 10, cellsNormalized: 40, cellsTrimmed: 0, columns: [], steps: [], preview: { columns: [], rows: [] } },
    profiles: [
      { name: "Date", type: "date", fillRate: 1, distinctCount: 12, cardinalityRatio: 0.1, samples: [], role: "time" },
      { name: "Revenue", type: "currency", fillRate: 1, distinctCount: 400, cardinalityRatio: 0.8, samples: [], role: "metric" },
    ],
    kpis: [],
    charts: [],
    insights: [],
    conclusions: [],
    narrator: "templated",
    ...overrides,
  };
}

describe("fingerprint", () => {
  it("is stable for the same shape and changes when the shape changes", () => {
    expect(fingerprint(spec())).toBe(fingerprint(spec()));
    const changed = spec({ rowCount: 501 });
    expect(fingerprint(changed)).not.toBe(fingerprint(spec()));
  });
});

describe("buildMethodology", () => {
  it("always includes a limitations section with the not-financial-advice disclaimer", () => {
    const sections = buildMethodology(spec());
    const limits = sections.find((s) => s.heading === "Assumptions & limitations")!;
    expect(limits).toBeDefined();
    expect(limits.items.some((i) => /not financial/i.test(i))).toBe(true);
  });

  it("notes the small-sample caveat when present", () => {
    const sections = buildMethodology(spec({ rowCount: 12, smallSample: true }));
    const limits = sections.find((s) => s.heading === "Assumptions & limitations")!;
    expect(limits.items.some((i) => /small/i.test(i))).toBe(true);
  });
});

describe("buildRecipe", () => {
  it("captures the shape and a matching fingerprint", () => {
    const r = buildRecipe(spec());
    expect(r.app).toBe("MyAnalyst");
    expect(r.columns).toHaveLength(2);
    expect(r.fingerprint).toBe(fingerprint(spec()));
  });
});
