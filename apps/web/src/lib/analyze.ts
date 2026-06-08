import type {
  Association,
  CategoryFact,
  ColumnProfile,
  CorrelationPair,
  DashboardSpec,
  DriverAnalysis,
  ForecastFact,
  GroupComparison,
  InsightContext,
  OutlierBreakdown,
  OutlierFact,
  RegressionResult,
  Table,
  TrendFact,
} from "./types";
import { numericColumn, profileTable } from "./profile";
import { cleanTable, type CleanResult } from "./clean";
import { detectDomain } from "./domain";
import { computeKpis, primaryMetric, sortByTime } from "./kpi";
import { recommendCharts } from "./charts";
import { isRedundantCorrelation, zOutliers } from "./stats";
import { benjaminiHochberg, chiSquareIndependence, multipleRegression, oneWayAnova, olsSimple, pearsonTest } from "./inference";
import { defaultHorizon, holtForecast } from "./forecast";
import { buildDataStory } from "./story";
import { computeDataQuality } from "./quality";
import { buildActionReport } from "./actions";
import { analyzeTimeSeries } from "./timeseries";
import { buildContributions } from "./contribution";
import { buildTextAnalyses } from "./text-analytics";
import { buildCaveats } from "./caveats";
import { segmentRows } from "./segment";
import { analyzeCohorts } from "./cohort";
import { analyzeConcentration } from "./concentration";
import { buildRelationships } from "./relationships";
import { analyzeRfm } from "./rfm";
import { getInsightProvider } from "./insights";
import { llmEnabled, sharpenStory } from "./insights/humanize";
import type { LlmConfig } from "./llm-settings";

// Pipeline orchestrator: Table -> full DashboardSpec. Mirrors docs/01-architecture.md stages 2..7,
// but runs locally in the browser for the Vercel-first MVP.

export async function analyze(
  rawTable: Table,
  opts: {
    userContext?: string;
    cleaned?: CleanResult;
    onStage?: (stage: string) => void;
    /** Optional bring-your-own-key LLM config; routes the narrator through the user's own provider. */
    llm?: LlmConfig;
    /** Skip chart construction. Chart `option` objects carry function formatters that can't be
     *  structured-cloned across a Web Worker boundary, so the worker skips them and the main
     *  thread (analyze-client) builds the charts after receiving the spec. */
    skipCharts?: boolean;
  } = {}
): Promise<DashboardSpec> {
  const stage = (s: string) => opts.onStage?.(s);

  // Stage 2: clean & normalize first, then run everything else on the trustworthy, typed table.
  // Cleaning is the heaviest preprocessing step (per-row dedup over up to 200k rows); callers that
  // also need the cleaned table can pass it in via `opts.cleaned` so we don't clean the same file twice.
  if (!opts.cleaned) stage("Cleaning & normalizing");
  const { table, report: cleaning, typeHints } = opts.cleaned ?? cleanTable(rawTable);

  stage("Profiling columns");
  const profiles = profileTable(table, typeHints);
  const quality = computeDataQuality(table, profiles, cleaning);
  const anomalies = detectAnomalies(table, profiles);
  const segmentation = segmentRows(table, profiles);
  const cohorts = analyzeCohorts(table, profiles);
  const concentration = analyzeConcentration(table, profiles);
  const relationships = buildRelationships(table, profiles);
  const rfm = analyzeRfm(table, profiles);
  stage("Detecting domain");
  const domain = detectDomain(profiles, opts.userContext);
  stage("Computing KPIs");
  const kpis = computeKpis(table, profiles, domain.domain);

  // Period-over-period (MoM/YoY) for the top metrics, when there's a usable time column.
  const timeCol = profiles.find((p) => p.role === "time");
  const timeAnalysis = timeCol
    ? profiles
        .filter((p) => p.role === "metric" && p.numeric)
        .slice(0, 3)
        .map((m) => analyzeTimeSeries(table, timeCol.name, m.name))
        .filter((a): a is NonNullable<typeof a> => a !== undefined)
    : [];
  // "What drove the change" — attribute the primary metric's period-over-period move to a dimension.
  const pmForContrib = primaryMetric(profiles);
  const contributions = timeCol && pmForContrib ? buildContributions(table, profiles, pmForContrib.name) : [];
  // Themes + sentiment for any free-text columns (open-ended feedback, reviews, notes).
  const textAnalysis = buildTextAnalyses(table, profiles);

  stage("Running statistics");
  const charts = opts.skipCharts ? [] : recommendCharts(table, profiles);

  const ctx = buildInsightContext(table, profiles, kpis, domain.domain, concentration);
  ctx.userContext = opts.userContext?.trim() || undefined;
  stage("Writing insights");
  const provider = getInsightProvider(opts.llm);
  const rawInsights = await provider.generate(ctx);
  // Quality filter: keep only meaningful insights (always keep the summary); drop
  // low-confidence "probably noise" items so the dashboard shows high-quality answers.
  const filtered = rawInsights.filter((i) => i.kind === "summary" || i.confidence !== "low");
  const insights = filtered.length ? filtered : rawInsights;

  // Read the data's own subject/story so findings stay connected to what it's about.
  // Heuristic first; if the LLM is enabled, sharpen it (metadata-only — never raw rows).
  let story = buildDataStory(rawTable.name, table.rowCount, profiles, domain, ctx.userContext);
  if (llmEnabled(opts.llm)) {
    story = await sharpenStory(story, {
      datasetName: rawTable.name,
      domain: domain.domain,
      rowCount: table.rowCount,
      columns: profiles.map((p) => ({ name: p.name, role: p.role, type: p.type })),
      userContext: ctx.userContext,
    }, opts.llm);
  }

  return {
    version: "1.0",
    datasetName: rawTable.name,
    domain,
    generatedAt: new Date().toISOString(),
    rowCount: table.rowCount,
    cleaning,
    profiles,
    kpis,
    charts,
    insights,
    conclusions: [],
    narrator: provider.lastSource ?? "templated",
    story,
    quality,
    anomalies,
    timeAnalysis: timeAnalysis.length ? timeAnalysis : undefined,
    segmentation,
    drivers: ctx.drivers,
    cohorts,
    actions: buildActionReport(ctx, quality, profiles),
    contributions: contributions.length ? contributions : undefined,
    textAnalysis: textAnalysis.length ? textAnalysis : undefined,
    caveats: (() => { const c = buildCaveats(profiles); return c.length ? c : undefined; })(),
    concentration: concentration.length ? concentration : undefined,
    relationships,
    rfm,
    smallSample: table.rowCount < 30 ? true : undefined,
  };
}

/** Per-metric unusual values (|z| > 3), strongest first — the metadata behind the Anomalies card. */
export function detectAnomalies(table: Table, profiles: ReturnType<typeof profileTable>): OutlierFact[] {
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  const dims = profiles.filter((p) => p.role === "dimension" && p.distinctCount >= 2 && p.distinctCount <= 50);
  const out: OutlierFact[] = [];
  for (const m of metrics) {
    const ex = zOutliers(numericColumn(table, m.name), 3);
    if (ex.length) {
      out.push({
        column: m.name,
        count: ex.length,
        examples: [...ex].sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 4),
        breakdown: anomalyBreakdown(table, dims, ex.map((e) => e.index)),
      });
    }
  }
  return out.sort((a, b) => b.count - a.count).slice(0, 6);
}

/**
 * Root-cause hint for a metric's anomalous rows: across the categorical dimensions, find the segment
 * where the anomalies cluster most disproportionately (highest lift = outlier-share ÷ base-share), so
 * the card can say "most of these came from store #14" instead of just "12 anomalies". Metadata-only.
 */
function anomalyBreakdown(table: Table, dims: ColumnProfile[], indices: number[]): OutlierBreakdown[] | undefined {
  if (indices.length < 3 || dims.length === 0) return undefined;
  const idxSet = new Set(indices);
  const n = table.rowCount;
  let best: OutlierBreakdown[] = [];
  let bestLift = 1.3; // require meaningful over-representation before we claim a cause
  for (const dim of dims) {
    const baseCount = new Map<string, number>();
    const outCount = new Map<string, number>();
    table.rows.forEach((r, i) => {
      const key = String(r[dim.name] ?? "—");
      baseCount.set(key, (baseCount.get(key) ?? 0) + 1);
      if (idxSet.has(i)) outCount.set(key, (outCount.get(key) ?? 0) + 1);
    });
    const rows: OutlierBreakdown[] = [];
    for (const [value, oc] of outCount) {
      if (oc < 2) continue;
      const outlierShare = oc / indices.length;
      const baseShare = (baseCount.get(value) ?? 0) / n;
      const lift = baseShare > 0 ? outlierShare / baseShare : Infinity;
      rows.push({ dimension: dim.name, value, count: oc, outlierShare, baseShare, lift });
    }
    rows.sort((a, b) => b.lift - a.lift || b.count - a.count);
    if (rows.length && rows[0].lift > bestLift) {
      bestLift = rows[0].lift;
      best = rows.slice(0, 2);
    }
  }
  return best.length ? best : undefined;
}

/** Assemble the metadata-only context for insight generation. NEVER includes raw rows. */
function buildInsightContext(
  table: Table,
  profiles: ReturnType<typeof profileTable>,
  kpis: DashboardSpec["kpis"],
  domain: InsightContext["domain"],
  concentration: InsightContext["concentration"]
): InsightContext {
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  const dims = profiles.filter((p) => p.role === "dimension");
  const time = profiles.find((p) => p.role === "time");

  // Correlations between metric pairs — with significance test + 95% CI (statsmodels-grade).
  const correlations: CorrelationPair[] = [];
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const test = pearsonTest(numericColumn(table, metrics[i].name), numericColumn(table, metrics[j].name));
      if (!test) continue;
      const abs = Math.abs(test.r);
      correlations.push({
        a: metrics[i].name,
        b: metrics[j].name,
        r: test.r,
        strength: abs > 0.7 ? "strong" : abs > 0.4 ? "moderate" : "weak",
        p: test.p,
        significant: test.significant,
        ciLow: test.ciLow,
        ciHigh: test.ciHigh,
        n: test.n,
      });
    }
  }
  // Drop trivially-redundant pairs before they become "insights": a near-perfect correlation almost
  // always means one column is derived from the other (tax from sales, total from price×qty, a unit
  // conversion, a duplicate column) — that's a tautology, not a finding. Same for name-subset pairs
  // like "Revenue" vs "Total Revenue". (The correlation heatmap still shows the full matrix.)
  {
    const kept = correlations.filter((c) => !isRedundantCorrelation(c.a, c.b, c.r));
    correlations.length = 0;
    correlations.push(...kept);
  }
  // Benjamini-Hochberg FDR correction across all pairwise correlation tests — guards against
  // false positives when many pairs are tested (a key accuracy fix vs. naive per-test p < 0.05).
  if (correlations.length > 1) {
    const keep = benjaminiHochberg(correlations.map((c) => c.p));
    correlations.forEach((c, i) => (c.significant = keep[i]));
  }
  // Rank by significance first, then strength.
  correlations.sort((a, b) => Number(b.significant) - Number(a.significant) || Math.abs(b.r) - Math.abs(a.r));

  // Regression with full inference: target/driver = the strongest SIGNIFICANT correlate pair.
  let regression: RegressionResult | undefined;
  const topCorr = correlations.find((c) => c.significant && c.strength !== "weak") ?? correlations.find((c) => c.strength !== "weak");
  if (topCorr) {
    const reg = olsSimple(numericColumn(table, topCorr.b), numericColumn(table, topCorr.a));
    if (reg) {
      regression = {
        target: topCorr.a,
        driver: topCorr.b,
        slope: reg.slope,
        intercept: reg.intercept,
        r2: reg.r2,
        adjR2: reg.adjR2,
        slopeP: reg.slopeP,
        slopeSE: reg.slopeSE,
        ciLow: reg.ciSlopeLow,
        ciHigh: reg.ciSlopeHigh,
        fP: reg.fP,
        n: reg.n,
        significant: reg.significant,
      };
    }
  }

  // Trends along the time axis — with a significance test on the time slope (real trend vs noise).
  const trends: TrendFact[] = [];
  if (time) {
    const order = sortByTime(table, time.name);
    for (const m of metrics.slice(0, 3)) {
      const mCol = numericColumn(table, m.name);
      const series = order.map((idx) => mCol[idx]).filter(Number.isFinite);
      if (series.length < 2) continue;
      const idx = series.map((_, i) => i);
      const reg = olsSimple(idx, series);
      // Use the FITTED trend line's endpoints, not the raw first/last rows — a single
      // noisy data point shouldn't define the trend. Magnitude/direction come from the
      // model, and a direction is only claimed when the slope is statistically real.
      const from = reg ? reg.intercept : series[0];
      const to = reg ? reg.intercept + reg.slope * (series.length - 1) : series[series.length - 1];
      const changePct = from !== 0 ? (to - from) / Math.abs(from) : 0;
      const real = reg?.significant === true;
      trends.push({
        metric: m.name,
        changePct,
        direction: !real ? "flat" : reg!.slope > 0 ? "up" : "down",
        from,
        to,
        slopeP: reg?.slopeP,
        significant: reg?.significant,
      });
    }
  }

  // Group comparisons (one-way ANOVA): does a metric's mean differ across a category's groups?
  const groupComparisons: GroupComparison[] = [];
  for (const dim of dims.slice(0, 3)) {
    if (dim.distinctCount < 2 || dim.distinctCount > 20) continue;
    for (const m of metrics.slice(0, 3)) {
      const groups = new Map<string, number[]>();
      const vals = numericColumn(table, m.name);
      table.rows.forEach((r, i) => {
        if (!Number.isFinite(vals[i])) return;
        const key = String(r[dim.name] ?? "—");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(vals[i]);
      });
      const a = oneWayAnova(groups);
      if (a && Number.isFinite(a.p)) {
        groupComparisons.push({
          metric: m.name,
          dimension: dim.name,
          f: a.f,
          p: a.p,
          etaSq: a.etaSq,
          significant: a.significant,
          top: a.groups[0],
          bottom: a.groups[a.groups.length - 1],
        });
      }
    }
  }
  if (groupComparisons.length > 1) {
    const keep = benjaminiHochberg(groupComparisons.map((g) => g.p));
    groupComparisons.forEach((g, i) => (g.significant = keep[i]));
  }
  groupComparisons.sort((a, b) => Number(b.significant) - Number(a.significant) || b.etaSq - a.etaSq);

  // Multiple-regression driver analysis: which numeric factors independently move the primary metric?
  let drivers: DriverAnalysis | undefined;
  const target = primaryMetric(profiles);
  if (target && metrics.length >= 3) {
    const predictors = metrics.filter((m) => m.name !== target.name).slice(0, 5);
    if (predictors.length >= 2) {
      const X = predictors.map((p) => numericColumn(table, p.name));
      const mr = multipleRegression(X, numericColumn(table, target.name), predictors.map((p) => p.name));
      if (mr) {
        const tNum = target.numeric;
        drivers = {
          target: target.name,
          r2: mr.r2,
          adjR2: mr.adjR2,
          fP: mr.fP,
          n: mr.n,
          drivers: mr.coefficients.map((c) => ({ name: c.name, coef: c.coef, beta: c.beta, p: c.p, significant: c.significant })),
          // Baselines for the what-if simulator: an OLS fit passes through the means, so the modeled
          // outcome at every-predictor-at-its-mean equals the target's mean. From there the UI projects
          // outcome = targetMean + Σ coefᵢ·(xᵢ − meanᵢ) — no raw rows needed.
          model: tNum
            ? {
                intercept: mr.intercept,
                targetMean: tNum.mean,
                targetStd: tNum.std,
                predictors: mr.coefficients.map((c) => {
                  const pr = predictors.find((p) => p.name === c.name)!.numeric!;
                  return { name: c.name, coef: c.coef, mean: pr.mean, std: pr.std, min: pr.min, max: pr.max };
                }),
              }
            : undefined,
        };
      }
    }
  }

  // Associations between categorical columns (chi-square test of independence).
  const associations: Association[] = [];
  const catCols = dims.filter((d) => d.distinctCount >= 2 && d.distinctCount <= 15);
  for (let i = 0; i < catCols.length; i++) {
    for (let j = i + 1; j < catCols.length; j++) {
      const counts = contingency(table, catCols[i], catCols[j]);
      const chi = chiSquareIndependence(counts);
      if (chi && Number.isFinite(chi.p)) {
        associations.push({
          a: catCols[i].name,
          b: catCols[j].name,
          chi2: chi.chi2,
          p: chi.p,
          cramersV: chi.cramersV,
          significant: chi.significant,
        });
      }
    }
  }
  associations.sort((a, b) => Number(b.significant) - Number(a.significant) || b.cramersV - a.cramersV);

  // Outliers per metric.
  const outliers: OutlierFact[] = [];
  for (const m of metrics) {
    const ex = zOutliers(numericColumn(table, m.name), 3);
    if (ex.length) outliers.push({ column: m.name, count: ex.length, examples: ex.slice(0, 3) });
  }
  outliers.sort((a, b) => b.count - a.count);

  // Forecast of the primary metric along the time axis.
  let forecast: ForecastFact | undefined;
  const pm = primaryMetric(profiles);
  if (time && pm) {
    const order = sortByTime(table, time.name);
    const pmCol = numericColumn(table, pm.name);
    const ser = order.map((i) => pmCol[i]).filter(Number.isFinite);
    const horizon = defaultHorizon(ser.length);
    const fc = holtForecast(ser, horizon);
    if (fc) {
      const changePct = fc.lastValue !== 0 ? (fc.projected - fc.lastValue) / Math.abs(fc.lastValue) : 0;
      forecast = { metric: pm.name, horizon, lastValue: fc.lastValue, projected: fc.projected, changePct };
    }
  }

  // Category frequency facts (drive "most common" conclusions/answers).
  const categories: CategoryFact[] = profiles
    .filter((p) => p.role === "dimension" && p.topValues && p.topValues.length > 0)
    .map((p) => ({
      column: p.name,
      total: Math.round((p.fillRate || 0) * table.rowCount),
      distinct: p.distinctCount,
      top: p.topValues!.slice(0, 6),
    }))
    // Most "informative" first: a clear leader (high top share) but more than one option.
    .sort((a, b) => (b.top[0]?.pct ?? 0) - (a.top[0]?.pct ?? 0))
    .slice(0, 4);

  return {
    domain,
    rowCount: table.rowCount,
    columns: profiles.map((p) => ({ name: p.name, type: p.type, role: p.role })),
    kpis,
    correlations: correlations.slice(0, 5),
    regression,
    trends,
    outliers: outliers.slice(0, 3),
    forecast,
    categories,
    groupComparisons: groupComparisons.slice(0, 4),
    associations: associations.slice(0, 4),
    drivers,
    concentration: concentration?.slice(0, 2),
    smallSample: table.rowCount < 30,
  };
}

/** Build a contingency table (counts) for two categorical columns, capped to their top values. */
function contingency(table: Table, colA: { name: string; topValues?: { value: string }[] }, colB: { name: string; topValues?: { value: string }[] }): number[][] {
  const aVals = (colA.topValues ?? []).slice(0, 10).map((v) => v.value);
  const bVals = (colB.topValues ?? []).slice(0, 10).map((v) => v.value);
  const aIdx = new Map(aVals.map((v, i) => [v, i]));
  const bIdx = new Map(bVals.map((v, i) => [v, i]));
  const counts = aVals.map(() => bVals.map(() => 0));
  for (const r of table.rows) {
    const ai = aIdx.get(String(r[colA.name] ?? ""));
    const bi = bIdx.get(String(r[colB.name] ?? ""));
    if (ai !== undefined && bi !== undefined) counts[ai][bi]++;
  }
  return counts;
}
