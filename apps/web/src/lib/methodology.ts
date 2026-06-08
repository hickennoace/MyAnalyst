import type { DashboardSpec } from "./types";
import { DISCLAIMER_TEXT } from "./disclaimer";

// Methodology appendix + reproducible recipe. A consultant deliverable states its assumptions and how
// the numbers were produced; a black-box monthly PDF doesn't. This derives a plain-language "how this
// was computed" from the spec, and a deterministic fingerprint so a re-run on the same file can be
// verified identical (the pipeline is pure + seeded — same input ⇒ same output).

export interface MethodologySection {
  heading: string;
  items: string[];
}

export function buildMethodology(spec: DashboardSpec): MethodologySection[] {
  const sections: MethodologySection[] = [];

  sections.push({
    heading: "Pipeline",
    items: [
      `${spec.rowCount.toLocaleString()} rows × ${spec.profiles.length} columns, analyzed entirely in your browser — no data left this device.`,
      "Stages: clean & normalize → profile & type columns → detect domain → KPIs → statistics → charts → insights.",
      spec.domain ? `Domain detected as "${spec.domain.domain}" (${Math.round(spec.domain.confidence * 100)}% confidence) — used to choose relevant metrics and templates.` : "",
    ].filter(Boolean),
  });

  const cleaning: string[] = [];
  if (spec.cleaning) {
    if (spec.cleaning.totalRowsRemoved) cleaning.push(`Removed ${spec.cleaning.totalRowsRemoved.toLocaleString()} rows (duplicates / empty).`);
    if (spec.cleaning.cellsNormalized) cleaning.push(`Normalized ${spec.cleaning.cellsNormalized.toLocaleString()} cells (currency, dates, numbers).`);
  }
  if (cleaning.length) sections.push({ heading: "Cleaning", items: cleaning });

  const methods: string[] = [];
  methods.push("Correlations use Pearson's r with a significance test and Benjamini–Hochberg FDR correction across all pairs (guards against false positives from many comparisons).");
  if (spec.drivers) methods.push(`Driver analysis is an ordinary-least-squares multiple regression of ${spec.drivers.target} on its numeric predictors (R² = ${Math.round(spec.drivers.r2 * 100)}%, n = ${spec.drivers.n.toLocaleString()}); β is the standardized effect.`);
  if (spec.contributions?.length) methods.push("Contribution analysis is an additive period-over-period decomposition — each segment's delta sums exactly to the total change.");
  if (spec.timeAnalysis?.length) methods.push("Trends aggregate the metric into its natural cadence with a moving average and period-over-period (and year-over-year where a full season exists) change.");
  if (spec.segmentation) methods.push(`Segments come from k-means clustering (k = ${spec.segmentation.k}) on the standardized numeric columns, with a fixed seed for reproducibility.`);
  if (spec.cohorts) methods.push("Cohort retention groups entities by their first period and tracks the share still active in each later period.");
  if (spec.relationships) methods.push("The relationship explorer is the full pairwise Pearson-correlation matrix; each pair carries a two-sided significance test and a Fisher-z 95% confidence interval, with near-perfect/derived pairs flagged.");
  if (spec.concentration?.length) methods.push("Concentration (Pareto) sums a measure by category, sorts descending, then reports the cumulative share, the count of categories reaching 80%, the Gini coefficient, and the HHI.");
  if (spec.rfm) methods.push(`RFM scores each ${spec.rfm.entity} on Recency, Frequency, and Monetary value into 1–5 quintiles (recency measured back from ${spec.rfm.asOf}), then maps the scores to named value segments.`);
  if (spec.anomalies?.length) methods.push("Anomalies are values more than 3 standard deviations from the mean (|z| > 3); root-cause attribution compares each segment's outlier share to its base rate (lift).");
  if (spec.textAnalysis?.length) methods.push("Open-text themes are the most frequent phrases (bigrams preferred); sentiment is a lexicon estimate with simple negation handling — directional, not definitive.");
  sections.push({ heading: "Statistical methods", items: methods });

  const limits: string[] = [
    "Statistical associations are not proof of cause; treat drivers and scenarios as informed hints.",
    "Forecasts and scenario projections assume past relationships hold and other factors stay put.",
  ];
  if (spec.smallSample) limits.push("This dataset is small (n < 30) — estimates are unstable and may swing with one more data point.");
  if (spec.caveats?.length) limits.push(`Some columns are incomplete or degenerate (${spec.caveats.map((c) => c.column).join(", ")}); figures derived from them are flagged in the dashboard.`);
  limits.push(DISCLAIMER_TEXT);
  sections.push({ heading: "Assumptions & limitations", items: limits });

  return sections;
}

/** A portable analysis recipe: the settings + a fingerprint that let a re-run be verified identical. */
export interface Recipe {
  app: "MyAnalyst";
  recipeVersion: 1;
  specVersion: string;
  datasetName: string;
  generatedAt: string;
  columns: { name: string; type: string }[];
  rowCount: number;
  /** deterministic fingerprint of the data shape — same file + settings ⇒ same fingerprint. */
  fingerprint: string;
}

/** Stable 32-bit hash (FNV-1a) rendered as 8 hex chars. */
export function fingerprint(spec: DashboardSpec): string {
  const basis = `${spec.version}|${spec.rowCount}|${spec.profiles.map((p) => `${p.name}:${p.type}`).join(",")}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function buildRecipe(spec: DashboardSpec): Recipe {
  return {
    app: "MyAnalyst",
    recipeVersion: 1,
    specVersion: spec.version,
    datasetName: spec.datasetName,
    generatedAt: spec.generatedAt,
    columns: spec.profiles.map((p) => ({ name: p.name, type: p.type })),
    rowCount: spec.rowCount,
    fingerprint: fingerprint(spec),
  };
}
