import { describe, expect, it } from "vitest";
import { profileTable } from "./profile";
import { buildChart } from "./charts";
import { parseChartRequest } from "./nl-chart";
import type { Table } from "./types";

function table(): Table {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    work_year: 2021 + (i % 3),
    salary: 50000 + i * 1000,
    role: i % 2 ? "Engineer" : "Analyst",
  }));
  return { name: "jobs.csv", columns: ["work_year", "salary", "role"], rows, rowCount: rows.length };
}
const t = table();
const profiles = profileTable(t);

describe("no chart of a column against itself", () => {
  it("buildChart falls back to a distribution when x === y", () => {
    const spec = buildChart(t, profiles, { type: "line", x: "salary", y: ["salary"] });
    expect(spec.type).toBe("histogram"); // not a meaningless flat line
  });

  it("the NL parser never produces a degenerate same-column line/bar", () => {
    const res = parseChartRequest("work_year by work_year", profiles);
    if (res.request) {
      const r = res.request;
      // A histogram (distribution of one column) is fine; a line/bar/scatter of x vs the same x is not.
      const degenerate = r.y.includes(r.x) && r.type !== "histogram" && !r.count;
      expect(degenerate).toBe(false);
    }
  });
});
