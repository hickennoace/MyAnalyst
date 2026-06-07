import { describe, expect, it } from "vitest";
import { analyzeTimeSeries } from "./timeseries";
import type { Table } from "./types";

function monthlyTable(): Table {
  // Two years of month-end revenue, rising over time.
  const rows: Record<string, unknown>[] = [];
  let v = 100;
  for (let y = 2022; y <= 2023; y++) {
    for (let m = 1; m <= 12; m++) {
      rows.push({ Date: `${y}-${String(m).padStart(2, "0")}-28`, Revenue: v });
      v += 10;
    }
  }
  return { name: "m.csv", columns: ["Date", "Revenue"], rows, rowCount: rows.length };
}

describe("analyzeTimeSeries", () => {
  it("detects monthly cadence and buckets by month", () => {
    const a = analyzeTimeSeries(monthlyTable(), "Date", "Revenue")!;
    expect(a).toBeDefined();
    expect(a.cadence).toBe("monthly");
    expect(a.periods).toHaveLength(24);
    expect(a.latest.label).toBe("2023-12");
  });

  it("computes month-over-month and year-over-year change", () => {
    const a = analyzeTimeSeries(monthlyTable(), "Date", "Revenue")!;
    // Each month is +10 over the previous; last = 330, prev = 320.
    expect(a.changePct).toBeCloseTo((330 - 320) / 320, 5);
    // 12 months earlier (2022-12) = 210; YoY = (330-210)/210.
    expect(a.yoyChangePct).toBeCloseTo((330 - 210) / 210, 5);
  });

  it("fills a moving average once the window is reached and finds best/worst", () => {
    const a = analyzeTimeSeries(monthlyTable(), "Date", "Revenue")!;
    expect(a.movingAvg[0]).toBeNull(); // window not yet filled
    expect(a.movingAvg[a.movingAvg.length - 1]).not.toBeNull();
    expect(a.best.value).toBeGreaterThan(a.worst.value);
  });

  it("returns undefined when there are too few points", () => {
    const t: Table = { name: "x.csv", columns: ["Date", "Revenue"], rows: [{ Date: "2023-01-01", Revenue: 5 }], rowCount: 1 };
    expect(analyzeTimeSeries(t, "Date", "Revenue")).toBeUndefined();
  });
});
