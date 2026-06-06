import type {
  CorrelationPair,
  DashboardSpec,
  InsightContext,
  OutlierFact,
  RegressionResult,
  Table,
  TrendFact,
} from "./types";
import { numericColumn, profileTable } from "./profile";
import { cleanTable } from "./clean";
import { detectDomain } from "./domain";
import { computeKpis, sortByTime } from "./kpi";
import { recommendCharts } from "./charts";
import { linearRegression, pearson, zOutliers } from "./stats";
import { getInsightProvider } from "./insights";

// Pipeline orchestrator: Table -> full DashboardSpec. Mirrors docs/01-architecture.md stages 2..7,
// but runs locally in the browser for the Vercel-first MVP.

export async function analyze(rawTable: Table): Promise<DashboardSpec> {
  // Stage 2: clean & normalize first, then run everything else on the trustworthy, typed table.
  const { table, report: cleaning, typeHints } = cleanTable(rawTable);

  const profiles = profileTable(table, typeHints);
  const domain = detectDomain(profiles);
  const kpis = computeKpis(table, profiles, domain.domain);
  const charts = recommendCharts(table, profiles);

  const ctx = buildInsightContext(table, profiles, kpis, domain.domain);
  const insights = await getInsightProvider().generate(ctx);

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
  };
}

/** Assemble the metadata-only context for insight generation. NEVER includes raw rows. */
function buildInsightContext(
  table: Table,
  profiles: ReturnType<typeof profileTable>,
  kpis: DashboardSpec["kpis"],
  domain: InsightContext["domain"]
): InsightContext {
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  const time = profiles.find((p) => p.role === "time");

  // Correlations between metric pairs.
  const correlations: CorrelationPair[] = [];
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const r = pearson(numericColumn(table, metrics[i].name), numericColumn(table, metrics[j].name));
      if (!Number.isFinite(r)) continue;
      const abs = Math.abs(r);
      correlations.push({
        a: metrics[i].name,
        b: metrics[j].name,
        r,
        strength: abs > 0.7 ? "strong" : abs > 0.4 ? "moderate" : "weak",
      });
    }
  }
  correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  // Regression: target = highest-variance metric, driver = its strongest correlate.
  let regression: RegressionResult | undefined;
  const topCorr = correlations.find((c) => c.strength !== "weak");
  if (topCorr) {
    const reg = linearRegression(numericColumn(table, topCorr.b), numericColumn(table, topCorr.a));
    regression = {
      target: topCorr.a,
      driver: topCorr.b,
      slope: reg.slope,
      intercept: reg.intercept,
      r2: reg.r2,
    };
  }

  // Trends along the time axis.
  const trends: TrendFact[] = [];
  if (time) {
    const order = sortByTime(table, time.name);
    for (const m of metrics.slice(0, 3)) {
      const series = order.map((idx) => numericColumn(table, m.name)[idx]).filter(Number.isFinite);
      if (series.length < 2) continue;
      const from = series[0];
      const to = series[series.length - 1];
      const changePct = from !== 0 ? (to - from) / Math.abs(from) : 0;
      trends.push({
        metric: m.name,
        changePct,
        direction: changePct > 0.02 ? "up" : changePct < -0.02 ? "down" : "flat",
        from,
        to,
      });
    }
  }

  // Outliers per metric.
  const outliers: OutlierFact[] = [];
  for (const m of metrics) {
    const ex = zOutliers(numericColumn(table, m.name), 3);
    if (ex.length) outliers.push({ column: m.name, count: ex.length, examples: ex.slice(0, 3) });
  }
  outliers.sort((a, b) => b.count - a.count);

  return {
    domain,
    rowCount: table.rowCount,
    columns: profiles.map((p) => ({ name: p.name, type: p.type, role: p.role })),
    kpis,
    correlations: correlations.slice(0, 5),
    regression,
    trends,
    outliers: outliers.slice(0, 3),
  };
}
