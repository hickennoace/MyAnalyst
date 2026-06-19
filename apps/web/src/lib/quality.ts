import type { CleaningReport, ColumnProfile, DataQuality, QualityCheck, Table } from "./types";
import { numericColumn } from "./profile";
import { zOutliers } from "./stats";

// Data-quality scorecard: a single 0–100 health score from five weighted, plain-language checks -
// completeness, uniqueness, informative columns, value consistency, and outlier levels. It reuses the
// cleaning report (already computed) plus the column profiles, so it's cheap. Each failing check carries
// a concrete fix. Pure function over metadata/aggregates - safe to run in the analysis Web Worker.

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const statusOf = (score: number): QualityCheck["status"] => (score >= 0.85 ? "good" : score >= 0.6 ? "warn" : "bad");

export function computeDataQuality(table: Table, profiles: ColumnProfile[], cleaning: CleaningReport): DataQuality {
  const cols = profiles.length || 1;
  const rows = table.rowCount || 1;

  // A. Completeness - average fill rate across columns.
  const avgFill = profiles.reduce((s, p) => s + (p.fillRate ?? 0), 0) / cols;
  const sparse = profiles.filter((p) => (p.fillRate ?? 1) < 0.9).sort((a, b) => a.fillRate - b.fillRate);
  const completeness: QualityCheck = {
    id: "completeness",
    label: "Completeness",
    score: clamp01(avgFill),
    weight: 0.3,
    status: statusOf(avgFill),
    detail: sparse.length
      ? `${sparse.length} column${sparse.length > 1 ? "s" : ""} below 90% filled - lowest "${sparse[0].name}" at ${Math.round(sparse[0].fillRate * 100)}%.`
      : "Every column is almost fully populated.",
    fix: sparse.length ? `Fill or drop the gaps in ${sparse.slice(0, 3).map((s) => `"${s.name}"`).join(", ")}.` : undefined,
  };

  // B. Uniqueness - how many duplicate rows the cleaner had to remove.
  const before = cleaning.rowsBefore || rows;
  const dupRate = before ? cleaning.duplicatesRemoved / before : 0;
  const dupScore = clamp01(1 - dupRate);
  const uniqueness: QualityCheck = {
    id: "uniqueness",
    label: "Uniqueness",
    score: dupScore,
    weight: 0.2,
    status: statusOf(dupScore),
    detail:
      cleaning.duplicatesRemoved > 0
        ? `${cleaning.duplicatesRemoved.toLocaleString()} duplicate row${cleaning.duplicatesRemoved > 1 ? "s" : ""} (${(dupRate * 100).toFixed(1)}%) were removed.`
        : "No duplicate rows detected.",
    fix: cleaning.duplicatesRemoved > 0 ? "Check the source for repeated exports or a missing unique key." : undefined,
  };

  // C. Informative columns - constant/zero-variance columns carry no signal.
  const constant = profiles.filter((p) => p.distinctCount <= 1);
  const infoScore = clamp01(1 - constant.length / cols);
  const informative: QualityCheck = {
    id: "informative",
    label: "Informative columns",
    score: infoScore,
    weight: 0.15,
    status: statusOf(infoScore),
    detail: constant.length
      ? `${constant.length} column${constant.length > 1 ? "s" : ""} hold a single value: ${constant.slice(0, 3).map((c) => `"${c.name}"`).join(", ")}.`
      : "Every column varies and carries information.",
    fix: constant.length ? "Drop constant columns - they only add noise." : undefined,
  };

  // D. Value consistency - how much reformatting the raw values needed (stray symbols, spacing, mixed formats).
  const totalCells = rows * cols;
  const messy = cleaning.cellsNormalized + cleaning.cellsTrimmed;
  const messyRate = totalCells ? messy / totalCells : 0;
  const consistencyScore = clamp01(1 - messyRate * 2); // half the cells reformatted → 0
  const consistency: QualityCheck = {
    id: "consistency",
    label: "Value consistency",
    score: consistencyScore,
    weight: 0.15,
    status: statusOf(consistencyScore),
    detail:
      messy > 0
        ? `${messy.toLocaleString()} cell${messy > 1 ? "s" : ""} needed cleanup (stray symbols, spacing, mixed formats) - ${(messyRate * 100).toFixed(1)}% of the data.`
        : "Values were already clean and consistently formatted.",
    fix: messyRate > 0.1 ? "Standardize formats at the source (one date format, no stray symbols or units in number cells)." : undefined,
  };

  // E. Outlier levels - fraction of numeric values that are extreme (|z| > 3.5).
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  let outlierCount = 0;
  let numericCells = 0;
  let worst: { col: string; count: number } | undefined;
  for (const m of metrics) {
    const col = numericColumn(table, m.name);
    numericCells += col.filter(Number.isFinite).length;
    const ex = zOutliers(col, 3.5);
    outlierCount += ex.length;
    if (ex.length && (!worst || ex.length > worst.count)) worst = { col: m.name, count: ex.length };
  }
  const outlierRate = numericCells ? outlierCount / numericCells : 0;
  const outlierScore = clamp01(1 - outlierRate * 10); // 10% extreme → 0
  const outliers: QualityCheck = {
    id: "outliers",
    label: "Outlier levels",
    score: metrics.length ? outlierScore : 1,
    weight: 0.2,
    status: metrics.length ? statusOf(outlierScore) : "good",
    detail:
      outlierCount > 0
        ? `${outlierCount.toLocaleString()} extreme value${outlierCount > 1 ? "s" : ""} (|z| > 3.5)${worst ? `, most in "${worst.col}"` : ""} - ${(outlierRate * 100).toFixed(2)}% of numbers.`
        : metrics.length
        ? "No extreme outliers in the numeric columns."
        : "No numeric columns to check.",
    fix: outlierRate > 0.01 ? `Inspect the extremes${worst ? ` in "${worst.col}"` : ""} - data-entry errors, or genuine rare events?` : undefined,
  };

  const checks = [completeness, uniqueness, informative, consistency, outliers];
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const score = Math.round((checks.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight) * 100);
  const grade: DataQuality["grade"] = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  const worstCheck = checks.filter((c) => c.status !== "good").sort((a, b) => a.score - b.score)[0];
  const summary = !worstCheck
    ? `Excellent data quality - ${score}/100. Nothing to fix before trusting the analysis.`
    : `${score >= 80 ? "Good" : score >= 60 ? "Fair" : "Weak"} data quality - ${score}/100. Biggest issue: ${worstCheck.label.toLowerCase()} - ${worstCheck.detail}`;

  return { score, grade, checks, summary };
}
