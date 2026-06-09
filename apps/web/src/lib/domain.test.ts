import { describe, expect, it } from "vitest";
import { detectDomain } from "./domain";
import { profileTable } from "./profile";
import type { Table } from "./types";

function table(name: string, columns: string[], rows: Record<string, unknown>[]): Table {
  return { name, columns, rows, rowCount: rows.length };
}

function days(n: number): string[] {
  const out: string[] = [];
  let d = new Date("2024-01-01").getTime();
  for (let i = 0; i < n; i++) {
    out.push(new Date(d).toISOString().slice(0, 10));
    d += 86_400_000;
  }
  return out;
}

describe("detectDomain", () => {
  it("labels a real sales stream (with keywords) sales-operational", () => {
    const ds = days(60);
    const rows = ds.map((date, i) => ({
      Date: date,
      Product: ["A", "B", "C"][i % 3],
      Quantity: (i % 5) + 1,
      Price: 100 + (i % 7) * 10,
    }));
    const dom = detectDomain(profileTable(table("sales.csv", ["Date", "Product", "Quantity", "Price"], rows)), undefined, rows.length);
    expect(dom.domain).toBe("sales-operational");
  });

  it("does NOT call a keyword-less transaction stream (fitness log) sales-operational", () => {
    const ds = days(60);
    const rows = ds.map((date, i) => ({
      Date: date,
      Activity: ["Swim", "Run", "Yoga", "Strength"][i % 4],
      Duration: 20 + (i % 60),
      Calories: 150 + (i % 40) * 25,
    }));
    const dom = detectDomain(profileTable(table("workouts.csv", ["Date", "Activity", "Duration", "Calories"], rows)), undefined, rows.length);
    expect(dom.domain).not.toBe("sales-operational");
  });
});
