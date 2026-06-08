import { describe, expect, it } from "vitest";
import { buildCaveats, caveatForKpi } from "./caveats";
import type { ColumnProfile, Kpi } from "./types";

function prof(name: string, fillRate: number, distinctCount = 100, role: ColumnProfile["role"] = "metric"): ColumnProfile {
  return { name, type: "number", fillRate, distinctCount, cardinalityRatio: 0.5, samples: [], role };
}

describe("buildCaveats", () => {
  it("flags badly and mildly incomplete columns by severity", () => {
    const caveats = buildCaveats([prof("Clean", 1), prof("Spotty", 0.85), prof("Empty", 0.4)]);
    const byCol = Object.fromEntries(caveats.map((c) => [c.column, c]));
    expect(byCol["Clean"]).toBeUndefined();
    expect(byCol["Spotty"].severity).toBe("warn");
    expect(byCol["Empty"].severity).toBe("bad");
    expect(caveats[0].column).toBe("Empty"); // bad sorts first
  });

  it("flags a degenerate single-value column and ignores identifiers", () => {
    const caveats = buildCaveats([prof("Constant", 1, 1), prof("Id", 0.3, 999, "identifier")]);
    expect(caveats.find((c) => c.column === "Constant")?.reason).toMatch(/one distinct/);
    expect(caveats.find((c) => c.column === "Id")).toBeUndefined();
  });
});

describe("caveatForKpi", () => {
  const caveats = buildCaveats([prof("Revenue", 0.5)]);
  it("matches a KPI whose computation references the flagged column", () => {
    const kpi: Kpi = { id: "k1", name: "Total Revenue", value: 100, howComputed: "Sum of Revenue", relevance: 1 };
    expect(caveatForKpi(kpi, caveats)?.column).toBe("Revenue");
  });
  it("returns nothing for an unrelated KPI", () => {
    const kpi: Kpi = { id: "k2", name: "Row count", value: 10, howComputed: "Number of rows", relevance: 1 };
    expect(caveatForKpi(kpi, caveats)).toBeUndefined();
  });
});
