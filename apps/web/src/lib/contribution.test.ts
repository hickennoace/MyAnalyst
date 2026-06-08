import { describe, expect, it } from "vitest";
import { decomposeChange } from "./contribution";
import type { Table } from "./types";

// Two months of revenue across three regions. Month 1 → Month 2:
//   North 100 → 160 (+60), South 80 → 70 (−10), East 50 → 50 (0).
// Total 230 → 280, totalDelta = +50.
function table(): Table {
  const rows = [
    { Date: "2023-01-15", Region: "North", Revenue: 100 },
    { Date: "2023-01-15", Region: "South", Revenue: 80 },
    { Date: "2023-01-15", Region: "East", Revenue: 50 },
    { Date: "2023-02-15", Region: "North", Revenue: 160 },
    { Date: "2023-02-15", Region: "South", Revenue: 70 },
    { Date: "2023-02-15", Region: "East", Revenue: 50 },
  ];
  return { name: "t.csv", columns: ["Date", "Region", "Revenue"], rows, rowCount: rows.length };
}

describe("decomposeChange", () => {
  it("attributes the total change to segments, summing to the total", () => {
    const a = decomposeChange(table(), "Date", "Revenue", "Region")!;
    expect(a).toBeDefined();
    expect(a.prevTotal).toBe(230);
    expect(a.latestTotal).toBe(280);
    expect(a.totalDelta).toBe(50);
    const sumDelta = a.segments.reduce((s, x) => s + x.delta, 0);
    expect(sumDelta).toBeCloseTo(50, 6);
  });

  it("ranks the biggest mover first with the right contribution share", () => {
    const a = decomposeChange(table(), "Date", "Revenue", "Region")!;
    const north = a.segments.find((s) => s.name === "North")!;
    expect(a.segments[0].name).toBe("North"); // |+60| is the largest move
    expect(north.delta).toBe(60);
    expect(north.contributionPct).toBeCloseTo(60 / 50, 6); // 120% — offset by South's drop
    expect(north.status).toBe("grew");
    const south = a.segments.find((s) => s.name === "South")!;
    expect(south.status).toBe("shrank");
  });

  it("flags new and lost segments", () => {
    const rows = [
      { Date: "2023-01-15", Region: "North", Revenue: 100 },
      { Date: "2023-01-15", Region: "Closing", Revenue: 40 },
      { Date: "2023-02-15", Region: "North", Revenue: 100 },
      { Date: "2023-02-15", Region: "Opening", Revenue: 25 },
    ];
    const a = decomposeChange({ name: "t", columns: ["Date", "Region", "Revenue"], rows, rowCount: 4 }, "Date", "Revenue", "Region")!;
    expect(a.segments.find((s) => s.name === "Opening")!.status).toBe("new");
    expect(a.segments.find((s) => s.name === "Closing")!.status).toBe("lost");
  });

  it("returns undefined without enough data", () => {
    const rows = [{ Date: "2023-01-15", Region: "North", Revenue: 100 }];
    expect(decomposeChange({ name: "t", columns: ["Date", "Region", "Revenue"], rows, rowCount: 1 }, "Date", "Revenue", "Region")).toBeUndefined();
  });
});
