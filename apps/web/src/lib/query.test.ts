import { describe, expect, it } from "vitest";
import { answerQuestion } from "./query";
import { profileTable } from "./profile";
import type { Table } from "./types";

function salesTable(): Table {
  // 6 rows so Region (2 distinct) is classified as a dimension (distinct/total < 0.5).
  const rows = [
    { Date: "2023-01-01", Region: "North", Revenue: 100, Units: 10 },
    { Date: "2023-01-08", Region: "South", Revenue: 200, Units: 20 },
    { Date: "2023-01-15", Region: "North", Revenue: 300, Units: 30 },
    { Date: "2023-01-22", Region: "South", Revenue: 150, Units: 15 },
    { Date: "2023-01-29", Region: "North", Revenue: 200, Units: 22 },
    { Date: "2023-02-05", Region: "South", Revenue: 100, Units: 11 },
  ];
  return { name: "s.csv", columns: ["Date", "Region", "Revenue", "Units"], rows, rowCount: rows.length };
}

const table = salesTable();
const profiles = profileTable(table);

// Two-dimension table (Region × Product) for cross-tab tests.
function crossTabTable(): Table {
  const rows = [
    { Region: "North", Product: "Widget", Revenue: 100 },
    { Region: "North", Product: "Widget", Revenue: 50 },
    { Region: "North", Product: "Gadget", Revenue: 40 },
    { Region: "South", Product: "Widget", Revenue: 30 },
    { Region: "South", Product: "Gadget", Revenue: 20 },
    { Region: "South", Product: "Gadget", Revenue: 10 },
    { Region: "North", Product: "Gadget", Revenue: 60 },
    { Region: "South", Product: "Widget", Revenue: 25 },
  ];
  return { name: "ct.csv", columns: ["Region", "Product", "Revenue"], rows, rowCount: rows.length };
}
const ctTable = crossTabTable();
const ctProfiles = profileTable(ctTable);

describe("answerQuestion", () => {
  it("answers a total aggregate", () => {
    const r = answerQuestion("total revenue", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("1,050");
  });

  it("ranks a dimension by a metric", () => {
    const r = answerQuestion("which region has the highest revenue", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("North"); // 100+300+200 = 600 > 200+150+100 = 450
    // Must be a revenue ranking (sum), NOT a count of regions.
    expect(r.answer).toMatch(/Revenue|600/);
    expect(r.chart?.type).toBe("bar");
  });

  it("computes a correlation with a scatter chart", () => {
    const r = answerQuestion("correlation between revenue and units", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer.toLowerCase()).toContain("correlation");
    expect(r.chart?.type).toBe("scatter");
  });

  it("counts rows", () => {
    const r = answerQuestion("how many records are there", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("6");
  });

  // ── Median aggregation ────────────────────────────────────────────────────────

  it("computes the median of a metric (even count → mean of the two middles)", () => {
    // Revenue sorted: 100, 100, 150, 200, 200, 300 → median = (150 + 200) / 2 = 175.
    const r = answerQuestion("median revenue", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("175");
    expect(r.answer.toLowerCase()).toContain("median");
    // Must NOT collapse to the generic total/average summary.
    expect(r.answer).not.toContain("1,050");
  });

  it("ranks groups by median when asked", () => {
    // North revenue sorted: 100, 200, 300 → median 200; South: 100, 150, 200 → median 150.
    const r = answerQuestion("highest median revenue by region", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("North");
    expect(r.answer.toLowerCase()).toContain("median");
    // The label must say "median", never mislabel a median as a "total".
    expect(r.answer.toLowerCase()).not.toContain("total");
  });

  // ── Count distinct ────────────────────────────────────────────────────────────

  it("counts distinct values of a named column", () => {
    const r = answerQuestion("how many distinct regions are there", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toMatch(/\b2\b/); // North, South
    expect(r.answer).toContain("Region");
  });

  it("answers 'unique' phrasing too", () => {
    const r = answerQuestion("number of unique regions", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toMatch(/\b2\b/);
  });

  it("does not hijack a plain row count as a distinct count", () => {
    const r = answerQuestion("how many records are there", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("6"); // still the row count, not a distinct count
  });

  it("fails gracefully on nonsense", () => {
    const r = answerQuestion("what is the meaning of life", table, profiles);
    expect(r.ok).toBe(false);
  });

  // ── Share / percentage-of-total (Wave 3 W3.4) ─────────────────────────────────

  it("computes a metric's share of total for a slice", () => {
    // North revenue 600 of grand total 1,050 = 57.1%.
    const r = answerQuestion("what percent of revenue comes from North", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("57.1%");
    expect(r.answer).toContain("North");
    expect(r.answer).toContain("600");
  });

  it("computes a row-count share when no metric is named", () => {
    // 3 South rows of 6 = 50%.
    const r = answerQuestion("what percentage of orders are in the South", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("50.0%");
    expect(r.answer).toMatch(/\b3\b/);
  });

  // ── Percentiles & quartiles (Wave 3 W3.5) ─────────────────────────────────────

  it("computes a percentile of a metric", () => {
    // Units sorted 10,11,15,20,22,30 → p90 idx 4.5 → 22 + 0.5*(30-22) = 26.
    const r = answerQuestion("what is the 90th percentile of units", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("26");
    expect(r.answer.toLowerCase()).toContain("percentile");
  });

  it("maps 'top quartile' to the 75th percentile", () => {
    const r = answerQuestion("top quartile of units", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer.toLowerCase()).toContain("75th percentile");
  });

  // ── Two-dimension cross-tab (Wave 3 W3.7) ─────────────────────────────────────

  it("breaks a metric down by two dimensions and names the top cell", () => {
    // North/Widget = 100+50 = 150 is the top combination.
    const r = answerQuestion("revenue by region and product", ctTable, ctProfiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("North");
    expect(r.answer).toContain("Widget");
    expect(r.answer).toContain("150");
    expect(r.chart?.type).toBe("bar");
  });

  // ── Filtered & conditional questions (Phase 1.1) ──────────────────────────────

  it("filters an aggregate by a categorical value", () => {
    const r = answerQuestion("total revenue for the North region", table, profiles);
    expect(r.ok).toBe(true);
    // North rows: 100 + 300 + 200 = 600 (not the full 1,050).
    expect(r.answer).toContain("600");
    expect(r.answer).toContain("North");
    expect(r.answer).not.toContain("1,050");
  });

  it("filters a row count by a categorical value", () => {
    const r = answerQuestion("how many records for South", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toMatch(/\b3\b/); // 3 South rows
    expect(r.answer).toContain("South");
  });

  it("filters by year on the time column", () => {
    const r = answerQuestion("total revenue in 2023", table, profiles);
    expect(r.ok).toBe(true);
    // Only the Feb 2023? No — five rows are Jan 2023, one is Feb 2023; all 2023 → 1,050.
    expect(r.answer).toContain("1,050");
    expect(r.answer).toContain("2023");
    // A year with no rows yields a graceful miss.
    const none = answerQuestion("total revenue in 2019", table, profiles);
    expect(none.ok).toBe(false);
  });

  it("filters an aggregate by a numeric comparison on a named metric", () => {
    const r = answerQuestion("total revenue where revenue is over 150", table, profiles);
    expect(r.ok).toBe(true);
    // Revenue > 150: 200 + 300 + 200 = 700.
    expect(r.answer).toContain("700");
    expect(r.answer.toLowerCase()).toContain("over 150");
  });

  it("combines a filter with a group-by ranking", () => {
    const r = answerQuestion("average units by region in 2023", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("2023");
    expect(r.answer.toLowerCase()).toContain("units");
  });

  it("leaves unfiltered questions unchanged", () => {
    const r = answerQuestion("total revenue", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("1,050");
    expect(r.answer).not.toMatch(/in 20|for Region|where/);
  });
});

// A fitness dataset like the one in the screenshot: Activity (dimension) + Intensity / Duration metrics.
// 12 rows / 3 activities so Activity is a proper dimension (cardinality 0.25 < 0.5). HIIT is the most
// intense; Yoga has the longest single session (90 min).
function fitnessTable(): Table {
  const rows = [
    { Activity: "Run", "Duration (min)": 30, Intensity: 6, Calories: 300 },
    { Activity: "Run", "Duration (min)": 45, Intensity: 7, Calories: 450 },
    { Activity: "Run", "Duration (min)": 35, Intensity: 6, Calories: 320 },
    { Activity: "Run", "Duration (min)": 40, Intensity: 7, Calories: 400 },
    { Activity: "HIIT", "Duration (min)": 20, Intensity: 10, Calories: 280 },
    { Activity: "HIIT", "Duration (min)": 25, Intensity: 9, Calories: 320 },
    { Activity: "HIIT", "Duration (min)": 22, Intensity: 10, Calories: 300 },
    { Activity: "HIIT", "Duration (min)": 24, Intensity: 9, Calories: 310 },
    { Activity: "Yoga", "Duration (min)": 60, Intensity: 3, Calories: 150 },
    { Activity: "Yoga", "Duration (min)": 90, Intensity: 2, Calories: 200 },
    { Activity: "Yoga", "Duration (min)": 70, Intensity: 3, Calories: 160 },
    { Activity: "Yoga", "Duration (min)": 80, Intensity: 2, Calories: 180 },
  ];
  return { name: "fit.csv", columns: ["Activity", "Duration (min)", "Intensity", "Calories"], rows, rowCount: rows.length };
}

describe("smart intent: 'most <quality> <thing>' (bug fix)", () => {
  const t = fitnessTable();
  const p = profileTable(t);

  it("answers 'most intense workout' by ranking the activity by intensity (not max Duration)", () => {
    const r = answerQuestion("What is the most intense workout?", t, p);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("Intensity");
    expect(r.answer).toContain("HIIT"); // HIIT has the highest average intensity
    expect(r.answer.toLowerCase()).not.toContain("duration"); // the old bug answered with Duration
  });

  it("handles 'most intense activity' and 'sport' the same correct way", () => {
    for (const q of ["What is the most intense activity?", "the most intense sport"]) {
      const r = answerQuestion(q, t, p);
      expect(r.answer).toContain("Intensity");
      expect(r.answer).toContain("HIIT");
    }
  });

  it("still treats 'maximum duration' as an overall extreme, not a per-group ranking", () => {
    const r = answerQuestion("what is the maximum duration", t, p);
    expect(r.ok).toBe(true);
    expect(r.answer.toLowerCase()).toContain("duration");
    expect(r.answer).toContain("90");
    expect(r.answer).not.toContain("Activity"); // not grouped
  });

  it("fuzzily resolves a stemmed column name (calorie → Calories)", () => {
    const r = answerQuestion("total calories", t, p);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("Calories");
  });
});

describe("multi-facet evidence (Phase 1.5)", () => {
  it("pre-computes the focal metric across multiple named dimensions", async () => {
    const { buildFocalFacts } = await import("./query");
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 30; i++) {
      rows.push({ Region: ["North", "South", "East"][i % 3], Product: ["A", "B"][i % 2], Revenue: 100 + i });
    }
    const t: Table = { name: "m.csv", columns: ["Region", "Product", "Revenue"], rows, rowCount: rows.length };
    const p = profileTable(t);
    const facts = buildFocalFacts("revenue by region and product", t, p) as {
      breakdowns?: { dimension: string; topGroups: { total: number }[] }[];
    };
    expect(facts.breakdowns).toBeDefined();
    expect(facts.breakdowns!.length).toBe(2);
    const dims = facts.breakdowns!.map((b) => b.dimension).sort();
    expect(dims).toEqual(["Product", "Region"]);
    for (const b of facts.breakdowns!) expect(b.topGroups[0].total).toBeGreaterThan(0);
  });
});

describe("comparison questions (Phase 1.2)", () => {
  it("compares a metric across two categorical values", () => {
    const r = answerQuestion("compare revenue for North vs South", table, profiles);
    expect(r.ok).toBe(true);
    // North total = 600, South total = 450.
    expect(r.answer).toContain("600");
    expect(r.answer).toContain("450");
    expect(r.answer).toContain("North"); // North is the higher side
    expect(r.answer.toLowerCase()).toContain("higher by");
    expect(r.chart?.type).toBe("bar");
  });

  it("honors average vs total in a comparison", () => {
    const r = answerQuestion("compare average revenue North vs South", table, profiles);
    expect(r.ok).toBe(true);
    // North avg = 600/3 = 200, South avg = 450/3 = 150.
    expect(r.answer).toContain("200");
    expect(r.answer).toContain("150");
    expect(r.answer.toLowerCase()).toContain("average");
  });

  it("does not hijack a two-metric correlation 'vs' question", () => {
    const r = answerQuestion("revenue vs units", table, profiles);
    expect(r.ok).toBe(true);
    // No dimension values / years named → falls through to correlation, not comparison.
    expect(r.answer.toLowerCase()).toContain("correlation");
    expect(r.chart?.type).toBe("scatter");
  });

  it("compares two years on the time column", () => {
    const rows = [
      { Date: "2022-01-01", Region: "North", Revenue: 100 },
      { Date: "2022-06-01", Region: "South", Revenue: 200 },
      { Date: "2023-01-01", Region: "North", Revenue: 300 },
      { Date: "2023-06-01", Region: "South", Revenue: 250 },
      { Date: "2023-09-01", Region: "North", Revenue: 150 },
      { Date: "2022-09-01", Region: "South", Revenue: 50 },
    ];
    const t: Table = { name: "y.csv", columns: ["Date", "Region", "Revenue"], rows, rowCount: rows.length };
    const p = profileTable(t);
    const r = answerQuestion("how does 2023 compare to 2022 for revenue", t, p);
    expect(r.ok).toBe(true);
    // 2023 total = 300+250+150 = 700; 2022 total = 100+200+50 = 350.
    expect(r.answer).toContain("700");
    expect(r.answer).toContain("350");
    expect(r.answer).toContain("2023");
  });

  it("detectComparison returns the dimension and slices", async () => {
    const { detectComparison } = await import("./query");
    const c = detectComparison("North vs South revenue", table, profiles);
    expect(c?.kind).toBe("category");
    expect(c?.column).toBe("Region");
    expect(c?.left.label).toBe("North");
    expect(c?.right.label).toBe("South");
  });
});

describe("show-the-math (Phase 1.4)", () => {
  it("explains how an aggregate was computed, including the row basis", () => {
    const r = answerQuestion("total revenue", table, profiles);
    expect(r.method).toBeDefined();
    expect(r.method!.toLowerCase()).toContain("revenue");
    expect(r.method).toContain("6 rows"); // full dataset
  });

  it("notes the filter and reduced row count in the method", () => {
    const r = answerQuestion("total revenue for North", table, profiles);
    expect(r.method).toBeDefined();
    expect(r.method).toContain("3 of 6 rows");
    expect(r.method).toContain("North");
  });

  it("describes a comparison's computation", () => {
    const r = answerQuestion("compare revenue North vs South", table, profiles);
    expect(r.method).toBeDefined();
    expect(r.method!.toLowerCase()).toContain("difference");
  });
});

describe("AI chart selection (Phase 1.3)", () => {
  it("accepts a well-formed chart request and keeps only real y columns", async () => {
    const { sanitizeChartRequest } = await import("./query");
    const req = sanitizeChartRequest(
      { type: "bar", x: "Region", y: ["Revenue", "Nonexistent"], aggregate: true },
      profiles
    );
    expect(req).toBeDefined();
    expect(req!.type).toBe("bar");
    expect(req!.x).toBe("Region");
    expect(req!.y).toEqual(["Revenue"]); // unknown column dropped
    expect(req!.aggregate).toBe(true);
  });

  it("rejects an unknown chart type", async () => {
    const { sanitizeChartRequest } = await import("./query");
    expect(sanitizeChartRequest({ type: "sankey", x: "Region", y: [] }, profiles)).toBeUndefined();
  });

  it("rejects an x column that isn't in the data", async () => {
    const { sanitizeChartRequest } = await import("./query");
    expect(sanitizeChartRequest({ type: "bar", x: "Made Up", y: ["Revenue"] }, profiles)).toBeUndefined();
  });

  it("rejects non-object input", async () => {
    const { sanitizeChartRequest } = await import("./query");
    expect(sanitizeChartRequest(null, profiles)).toBeUndefined();
    expect(sanitizeChartRequest("bar chart please", profiles)).toBeUndefined();
  });
});

describe("detectFilter", () => {
  it("returns undefined when there is no condition", async () => {
    const { detectFilter } = await import("./query");
    expect(detectFilter("total revenue by region", table, profiles)).toBeUndefined();
  });

  it("detects a categorical value filter", async () => {
    const { detectFilter, applyFilter } = await import("./query");
    const f = detectFilter("revenue for North", table, profiles);
    expect(f?.column).toBe("Region");
    expect(applyFilter(table, f!).rowCount).toBe(3);
  });
});

// ── Wave 4: consultant-grade reasoning in Q&A ───────────────────────────────────
describe("Wave 4 — statistical reasoning", () => {
  it("W4.1 runs a significance test on a two-group difference", () => {
    const r = answerQuestion("is revenue significantly different for North vs South", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer.toLowerCase()).toContain("significant");
    expect(r.answer).toContain("200"); // North mean
    expect(r.answer).toContain("150"); // South mean
    expect(r.method?.toLowerCase()).toContain("t-test");
  });

  it("W4.2 identifies the strongest driver via multiple regression", () => {
    // Visits is deliberately NOT collinear with Spend (otherwise the design matrix is singular).
    const rows = [
      { Spend: 10, Visits: 100, Sales: 100 },
      { Spend: 20, Visits: 40, Sales: 210 },
      { Spend: 30, Visits: 75, Sales: 290 },
      { Spend: 40, Visits: 30, Sales: 410 },
      { Spend: 50, Visits: 90, Sales: 500 },
      { Spend: 60, Visits: 55, Sales: 610 },
      { Spend: 70, Visits: 20, Sales: 690 },
      { Spend: 80, Visits: 65, Sales: 800 },
    ];
    const dt: Table = { name: "d.csv", columns: ["Spend", "Visits", "Sales"], rows, rowCount: rows.length };
    const dp = profileTable(dt);
    const r = answerQuestion("what drives sales", dt, dp);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("Spend"); // Sales ≈ 10 × Spend → Spend is the top driver
    expect(r.answer.toLowerCase()).toContain("driver");
    expect(r.method?.toLowerCase()).toContain("regression");
  });

  it("W4.3 finds an extreme outlier", () => {
    const rows = Array.from({ length: 19 }, (_, i) => ({ V: 40 + i }));
    rows.push({ V: 5000 });
    const ot: Table = { name: "o.csv", columns: ["V"], rows, rowCount: rows.length };
    const op = profileTable(ot);
    const r = answerQuestion("are there any outliers in V", ot, op);
    expect(r.ok).toBe(true);
    expect(r.answer.toLowerCase()).toContain("outlier");
    expect(r.answer).toContain("5,000");
  });

  it("W4.3 reports a clean column when there are no outliers", () => {
    const r = answerQuestion("are there outliers in revenue", table, profiles);
    expect(r.ok).toBe(true);
    expect(r.answer.toLowerCase()).toMatch(/no values|clean/);
  });

  it("W4.4 reports a monthly trend with period-over-period change", () => {
    const rows = [
      { Date: "2023-01-01", Rev: 100 },
      { Date: "2023-02-01", Rev: 150 },
      { Date: "2023-03-01", Rev: 200 },
      { Date: "2023-04-01", Rev: 120 },
      { Date: "2023-05-01", Rev: 250 },
      { Date: "2023-06-01", Rev: 300 },
    ];
    const mt: Table = { name: "m.csv", columns: ["Date", "Rev"], rows, rowCount: rows.length };
    const mp = profileTable(mt);
    const r = answerQuestion("monthly revenue trend", mt, mp);
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("2023-06");
    expect(r.answer).toContain("20.0%"); // (300 - 250) / 250
    expect(r.chart?.type).toBe("line");
  });

  // Concentration / Pareto over a skewed measure across ≥4 categories.
  function paretoTable(): Table {
    const per: Record<string, number> = { A: 60, B: 20, C: 12, D: 5, E: 3 };
    const rows: Record<string, unknown>[] = [];
    for (const [Product, Sales] of Object.entries(per)) for (let i = 0; i < 3; i++) rows.push({ Product, Sales: Sales / 3 });
    return { name: "p.csv", columns: ["Product", "Sales"], rows, rowCount: rows.length };
  }

  it("answers a concentration / 80–20 question with the Pareto share and Gini", () => {
    const pt = paretoTable();
    const pp = profileTable(pt);
    const r = answerQuestion("how concentrated is Sales across Product?", pt, pp);
    expect(r.ok).toBe(true);
    expect(r.answer).toMatch(/account for/i);
    expect(r.answer).toMatch(/Gini/i);
    expect(r.answer).toContain('"A"'); // the dominant product is called out
    expect(r.chart?.type).toBe("bar");
    expect(r.method).toMatch(/Pareto/i);
  });

  it("answers 'do the top products drive most of sales' as concentration", () => {
    const pt = paretoTable();
    const r = answerQuestion("do the top products drive most of Sales", pt, profileTable(pt));
    expect(r.ok).toBe(true);
    expect(r.answer).toMatch(/top \d+ of 5 Products/i);
  });

  it("finds the strongest correlate of a single named metric", () => {
    // Sales tracks Spend strongly but with enough noise to stay below the 0.98 "redundant/derived" cutoff;
    // Noise is unrelated. So the strongest *real* correlate of Spend should be Sales.
    const rows = Array.from({ length: 30 }, (_, i) => ({ Spend: i, Sales: i + (((i * 31) % 23) - 11), Noise: (i * 7) % 5 }));
    const t: Table = { name: "c.csv", columns: ["Spend", "Sales", "Noise"], rows, rowCount: rows.length };
    const r = answerQuestion("what is most correlated with Spend?", t, profileTable(t));
    expect(r.ok).toBe(true);
    expect(r.answer).toContain("Sales"); // Sales tracks Spend far more than Noise
    expect(r.chart?.type).toBe("scatter");
  });
});
