import { describe, expect, it } from "vitest";
import { analyzeTimeSeries, detectSeasonality } from "./timeseries";
import type { PeriodPoint, Table } from "./types";

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

describe("detectSeasonality", () => {
  // Three years of monthly data with a strong December peak and a February trough.
  function seasonalMonths(): PeriodPoint[] {
    const lift = [0.9, 0.8, 1, 1, 1, 1, 1, 1, 1, 1.1, 1.3, 1.7]; // Jan..Dec multipliers
    const periods: PeriodPoint[] = [];
    for (let y = 2021; y <= 2023; y++) for (let m = 1; m <= 12; m++) {
      periods.push({ label: `${y}-${String(m).padStart(2, "0")}`, value: 1000 * lift[m - 1] });
    }
    return periods;
  }

  it("finds the peak and trough month with indices vs the average", () => {
    const s = detectSeasonality(seasonalMonths(), "monthly")!;
    expect(s).toBeDefined();
    expect(s.unit).toBe("month");
    expect(s.peak.label).toBe("Dec");
    expect(s.trough.label).toBe("Feb");
    expect(s.peak.index).toBeGreaterThan(1.3);
    expect(s.indices).toHaveLength(12);
    expect(s.strength).toBeCloseTo(s.peak.index - s.trough.index, 9);
  });

  it("returns undefined for a flat (non-seasonal) profile", () => {
    const flat: PeriodPoint[] = [];
    for (let y = 2021; y <= 2023; y++) for (let m = 1; m <= 12; m++) flat.push({ label: `${y}-${String(m).padStart(2, "0")}`, value: 1000 });
    expect(detectSeasonality(flat, "monthly")).toBeUndefined();
  });

  it("returns undefined without at least two full cycles", () => {
    const oneYear: PeriodPoint[] = [];
    for (let m = 1; m <= 12; m++) oneYear.push({ label: `2023-${String(m).padStart(2, "0")}`, value: m === 12 ? 5000 : 1000 });
    expect(detectSeasonality(oneYear, "monthly")).toBeUndefined();
  });

  it("detects weekday seasonality from daily periods", () => {
    const days: PeriodPoint[] = [];
    const start = Date.UTC(2024, 0, 1); // a Monday
    for (let i = 0; i < 28; i++) {
      const d = new Date(start + i * 86_400_000);
      const wd = d.getUTCDay();
      const weekend = wd === 0 || wd === 6;
      days.push({ label: d.toISOString().slice(0, 10), value: weekend ? 2000 : 1000 });
    }
    const s = detectSeasonality(days, "daily")!;
    expect(s).toBeDefined();
    expect(s.unit).toBe("weekday");
    expect(["Sat", "Sun"]).toContain(s.peak.label);
  });
});
