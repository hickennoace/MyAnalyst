import type { ChartSpec, ChartType, ColumnProfile, Table } from "./types";
import { numericColumn } from "./profile";
import { maxOf, minOf, pearson } from "./stats";
import { primaryMetric, sortByTime } from "./kpi";
import { defaultHorizon, forecastBand, forecastSeries } from "./forecast";
import { isTransactionGrain, revenueMetric } from "./semantics";
import { analyzeBestSellers } from "./bestsellers";
import { analyzeTimeSeries, trimPartialTail } from "./timeseries";
import {
  ANIMATION, INK, PALETTE, barSeries, categoryAxis, color, grid, legend, lineSeries, tooltip, valueAxis, vGradient,
} from "./chart-theme";

// Chart engine. Two entry points:
//   - recommendCharts(): the engine auto-picks charts from data shape (no user input).
//   - buildChart(): construct a specific chart on demand (the "generate graph" feature).
// Both emit ready-to-render ECharts `option` objects, styled via the shared chart theme (BI-tool look).

function axisLabels(table: Table, col: string, order?: number[]): string[] {
  const idx = order ?? table.rows.map((_, i) => i);
  return idx.map((i) => String(table.rows[i][col] ?? ""));
}

/** Aggregate a metric by a dimension (sum), returning sorted [label, value] pairs (top N). */
function aggregateBy(table: Table, dim: string, metric: string, topN = 12): [string, number][] {
  const acc = new Map<string, number>();
  const vals = numericColumn(table, metric);
  table.rows.forEach((r, i) => {
    const key = String(r[dim] ?? "—");
    const v = vals[i];
    if (Number.isFinite(v)) acc.set(key, (acc.get(key) ?? 0) + v);
  });
  return [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
}

/** Compact value label for bar tops (e.g. 12.3k, 1.2M). */
const valueLabel = {
  show: true,
  position: "top",
  color: INK.sub,
  fontSize: 11,
  formatter: (p: { value: number }) => compact(p.value),
};
function compact(n: number): string {
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

/** A sorted bar chart of [label, value] pairs (already aggregated). */
function barByDim(title: string, rationale: string, pairs: [string, number][]): ChartSpec {
  return {
    id: "chart-bar-by-dim",
    type: "bar",
    title,
    rationale,
    option: {
      ...ANIMATION,
      tooltip: tooltip(),
      grid: grid({ top: 28 }),
      xAxis: categoryAxis(pairs.map((p) => p[0]), { axisLabel: { color: INK.sub, fontSize: 11, rotate: pairs.length > 6 ? 28 : 0, hideOverlap: true } }),
      yAxis: valueAxis(),
      series: [barSeries(pairs.map((p) => p[1]), 0, { label: valueLabel })],
    },
  };
}

// ── Auto-recommendation ────────────────────────────────────────────────────

export function recommendCharts(table: Table, profiles: ColumnProfile[]): ChartSpec[] {
  const charts: ChartSpec[] = [];
  const time = profiles.find((p) => p.role === "time");
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  const dims = profiles.filter((p) => p.role === "dimension");

  // 1. Trend over time. For transaction data, that's total REVENUE per month (a clean trend line) — not
  //    a noisy tangle of every sale's price and the buyer's age. Otherwise, the raw metrics over time.
  const grainForTrend = isTransactionGrain(profiles, table.rowCount);
  const revForTrend = grainForTrend ? revenueMetric(profiles, grainForTrend) : undefined;
  if (time && revForTrend) {
    const ts = analyzeTimeSeries(table, time.name, revForTrend.name, "monthly");
    if (ts && ts.periods.length >= 3) {
      const label = /revenue|sales|amount|spend|cost|profit/i.test(revForTrend.name) ? revForTrend.name : "revenue";
      charts.push({
        id: "chart-timeseries",
        type: "line",
        title: `Monthly ${label.toLowerCase()} over time`,
        rationale: "Transaction data → total revenue summed per month, the trend that actually matters.",
        option: {
          ...ANIMATION,
          color: PALETTE,
          tooltip: tooltip(),
          grid: grid({ top: 24 }),
          xAxis: categoryAxis(ts.periods.map((p) => p.label), { boundaryGap: false }),
          yAxis: valueAxis(),
          series: [lineSeries(`monthly ${label.toLowerCase()}`, ts.periods.map((p) => p.value), 0, { area: true })],
        },
      });
    }
  } else if (time && metrics.length) {
    const order = sortByTime(table, time.name);
    const x = axisLabels(table, time.name, order);
    const chosen = metrics.slice(0, 4);
    const series = chosen.map((m, i) => {
      const col = numericColumn(table, m.name);
      return lineSeries(m.name, order.map((idx) => col[idx]), i, { area: chosen.length === 1 });
    });
    charts.push({
      id: "chart-timeseries",
      type: "line",
      title: `${chosen.map((m) => m.name).join(", ")} over ${time.name}`,
      rationale: "A time column plus numeric metrics → trend over time.",
      option: {
        ...ANIMATION,
        color: PALETTE,
        tooltip: tooltip(),
        legend: chosen.length > 1 ? legend() : undefined,
        grid: grid({ top: chosen.length > 1 ? 44 : 24 }),
        xAxis: categoryAxis(x, { boundaryGap: false }),
        yAxis: valueAxis(),
        series,
      },
    });
  }

  // 2. "What sells the most": total REVENUE by the product/category dimension — the headline sales chart.
  //    Falls back to summing a generic additive metric by the first dimension when there's no revenue.
  const grain = isTransactionGrain(profiles, table.rowCount);
  const revenue = revenueMetric(profiles, grain);
  const bs = revenue ? analyzeBestSellers(table, profiles) : undefined;
  if (revenue && bs) {
    const pairs = aggregateBy(table, bs.dimension, revenue.name);
    if (pairs.length >= 2) {
      charts.push(barByDim(`Revenue by ${bs.dimension}`, "Total revenue per category — which products actually drive the money.", pairs));
    }
  } else if (dims.length && metrics.length) {
    const dim = dims[0];
    const metric = metrics[0];
    const pairs = aggregateBy(table, dim.name, metric.name);
    if (pairs.length >= 2) {
      charts.push(barByDim(`${metric.name} by ${dim.name}`, "A category column plus a metric → comparison across groups.", pairs));
    }
  }

  // 2b. Forecast of the primary metric when there's a long-enough time series.
  if (time) {
    const fc = forecastChart(table, profiles, time);
    if (fc) charts.push(fc);
  }

  // 2c. Frequency (count) charts for key categorical columns — the core of categorical-only datasets.
  const RANKY = /(reason|category|type|status|segment|group|class|gender|channel|source|outcome|result|stage|priority|label|tag)/i;
  const freqDims = profiles
    .filter((p) => p.role === "dimension" && p.distinctCount >= 2 && p.distinctCount <= 25)
    .sort((a, b) => (RANKY.test(b.name) ? 1 : 0) - (RANKY.test(a.name) ? 1 : 0));
  for (const d of freqDims.slice(0, 2)) charts.push(frequencyChart(table, d.name));

  // 3. Correlation heatmap when there are several metrics.
  if (metrics.length >= 3) charts.push(correlationHeatmap(table, metrics));

  // 4. Scatter of the two most-correlated metrics (relationship view).
  if (metrics.length >= 2) {
    const best = mostCorrelatedPair(table, metrics);
    if (best && Math.abs(best.r) > 0.3) {
      const xs = numericColumn(table, best.a);
      const ys = numericColumn(table, best.b);
      const data = xs.map((x, i) => [x, ys[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
      charts.push({
        id: "chart-scatter",
        type: "scatter",
        title: `${best.a} vs ${best.b}`,
        subtitle: `r = ${best.r.toFixed(2)}`,
        rationale: "The two most strongly correlated metrics → relationship view.",
        option: scatterOption(best.a, best.b, data),
      });
    }
  }

  return charts;
}

function scatterOption(xName: string, yName: string, data: number[][]) {
  return {
    ...ANIMATION,
    tooltip: tooltip({ trigger: "item", formatter: (p: { value: number[] }) => `${xName}: ${compact(p.value[0])}<br/>${yName}: ${compact(p.value[1])}` }),
    grid: grid({ top: 24, left: 24 }),
    xAxis: valueAxis({ name: xName, nameLocation: "middle", nameGap: 28, nameTextStyle: { color: INK.faint, fontSize: 11 } }),
    yAxis: valueAxis({ name: yName, nameLocation: "middle", nameGap: 40, nameTextStyle: { color: INK.faint, fontSize: 11 } }),
    series: [{
      type: "scatter",
      data,
      symbolSize: 10,
      itemStyle: { color: vGradient(color(0), 0.9, 0.5), borderColor: color(0), borderWidth: 1, opacity: 0.8 },
      emphasis: { itemStyle: { opacity: 1, borderWidth: 2 } },
    }],
  };
}

function forecastChart(table: Table, profiles: ColumnProfile[], time: ColumnProfile): ChartSpec | null {
  // For transaction data, forecast total REVENUE per month (a real flow); otherwise forecast the primary
  // metric's series directly (e.g. a price level in financial data).
  const grain = isTransactionGrain(profiles, table.rowCount);
  const revenue = revenueMetric(profiles, grain);
  let series: number[];
  let histLabels: string[];
  let metricLabel: string;
  if (grain && revenue) {
    const ts = analyzeTimeSeries(table, time.name, revenue.name, "monthly");
    if (!ts) return null;
    const periods = ts.periods.slice();
    const trimmed = trimPartialTail(periods.map((p) => p.value));
    series = trimmed.filter(Number.isFinite);
    histLabels = periods.slice(0, trimmed.length).map((p) => p.label);
    metricLabel = /revenue|sales|amount|spend|cost|profit/i.test(revenue.name) ? `Monthly ${revenue.name.toLowerCase()}` : "Monthly revenue";
  } else {
    const pm = primaryMetric(profiles);
    if (!pm) return null;
    const order = sortByTime(table, time.name);
    const values = numericColumn(table, pm.name);
    series = order.map((i) => values[i]).filter(Number.isFinite);
    histLabels = order.map((i) => String(table.rows[i][time.name] ?? ""));
    metricLabel = pm.name;
  }
  if (series.length < 6) return null;

  const horizon = defaultHorizon(series.length);
  const fc = forecastSeries(series, horizon);
  if (!fc) return null;

  const forecastLabels = Array.from({ length: horizon }, (_, h) => `+${h + 1}`);
  const x = [...histLabels, ...forecastLabels];

  const actual: (number | null)[] = [...series, ...Array(horizon).fill(null)];
  const projected: (number | null)[] = [...Array(series.length - 1).fill(null), series[series.length - 1], ...fc.forecast];

  // 95% prediction interval, drawn as a shaded band: a transparent "lower" base line plus a stacked
  // "range" area on top of it (upper − lower). The band only spans the forecast steps; history is null.
  const { lower, upper } = forecastBand(fc);
  const lowerSeries: (number | null)[] = [...Array(series.length).fill(null), ...lower];
  const rangeSeries: (number | null)[] = [...Array(series.length).fill(null), ...upper.map((u, i) => u - lower[i])];
  const bandColor = color(3);

  return {
    id: "chart-forecast",
    type: "line",
    title: `${metricLabel} forecast (+${horizon} periods)`,
    subtitle: fc.seasonal
      ? `Holt-Winters (seasonal, period ${fc.period}) · α=${fc.alpha}, β=${fc.beta}, γ=${fc.gamma} · shaded = 95% range`
      : `Holt's linear trend · α=${fc.alpha}, β=${fc.beta} · shaded = 95% range`,
    rationale: fc.seasonal
      ? "A seasonal time series → a forward projection that carries the recurring cycle (Holt-Winters), not just the trend, with a 95% prediction interval that widens with the horizon."
      : "A long-enough time series → a short forward projection of the primary metric, with a 95% prediction interval that widens with the horizon.",
    option: {
      ...ANIMATION,
      color: [color(0), color(3)],
      tooltip: tooltip(),
      legend: legend({ data: ["actual", "forecast"] }),
      grid: grid(),
      xAxis: categoryAxis(x, { boundaryGap: false }),
      yAxis: valueAxis(),
      series: [
        // Band base (invisible) + band fill, stacked so the fill sits between lower and upper.
        { name: "ci-lower", type: "line", stack: "ci", data: lowerSeries, lineStyle: { opacity: 0 }, symbol: "none", silent: true, tooltip: { show: false }, z: 1 },
        { name: "ci-range", type: "line", stack: "ci", data: rangeSeries, lineStyle: { opacity: 0 }, symbol: "none", silent: true, tooltip: { show: false }, areaStyle: { color: bandColor, opacity: 0.14 }, z: 1 },
        lineSeries("actual", actual, 0, { area: true }),
        lineSeries("forecast", projected, 3, { dashed: true }),
      ],
    },
  };
}

function frequencyChart(table: Table, col: string): ChartSpec {
  const pairs = aggregateCount(table, col);
  const total = pairs.reduce((s, [, c]) => s + c, 0);
  const topShare = total ? ((pairs[0]?.[1] ?? 0) / total) * 100 : 0;
  return {
    id: `chart-freq-${col}`,
    type: "bar",
    title: `Most common ${col}`,
    subtitle: pairs.length ? `“${pairs[0][0]}” leads (${topShare.toFixed(0)}%)` : undefined,
    rationale: "Counts how often each value occurs — works for any text/category column.",
    option: {
      ...ANIMATION,
      tooltip: tooltip(),
      grid: grid({ top: 28 }),
      xAxis: categoryAxis(pairs.map((p) => p[0]), { axisLabel: { color: INK.sub, fontSize: 11, rotate: pairs.length > 5 ? 28 : 0, interval: 0, hideOverlap: true } }),
      yAxis: valueAxis({ name: "count" }),
      series: [barSeries(pairs.map((p) => p[1]), 1, { label: valueLabel })],
    },
  };
}

function correlationHeatmap(table: Table, metrics: ColumnProfile[]): ChartSpec {
  const cols = metrics.slice(0, 8).map((m) => m.name);
  const data: [number, number, number][] = [];
  for (let i = 0; i < cols.length; i++)
    for (let j = 0; j < cols.length; j++) {
      const r = i === j ? 1 : pearson(numericColumn(table, cols[i]), numericColumn(table, cols[j]));
      data.push([j, i, Number.isFinite(r) ? Number(r.toFixed(2)) : 0]);
    }
  return {
    id: "chart-corr",
    type: "heatmap",
    title: "Correlation matrix",
    rationale: "Several numeric metrics → pairwise correlation strength at a glance.",
    option: {
      ...ANIMATION,
      tooltip: tooltip({ trigger: "item", position: "top", formatter: (p: { data: [number, number, number] }) => `${cols[p.data[1]]} ↔ ${cols[p.data[0]]}<br/>r = ${p.data[2]}` }),
      grid: { left: 16, right: 16, top: 24, bottom: 72, containLabel: true },
      xAxis: { type: "category", data: cols, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: INK.sub, fontSize: 11, rotate: 28 } },
      yAxis: { type: "category", data: cols, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: INK.sub, fontSize: 11 } },
      visualMap: {
        min: -1, max: 1, calculable: true, orient: "horizontal", left: "center", bottom: 4,
        inRange: { color: ["#E8684A", "#0f172a", "#5AD8A6"] }, textStyle: { color: INK.sub, fontSize: 10 },
      },
      series: [{
        type: "heatmap", data,
        label: { show: true, color: "#e2e8f0", fontSize: 11 },
        itemStyle: { borderColor: "#0a0e16", borderWidth: 3, borderRadius: 4 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.4)" } },
      }],
    },
  };
}

function mostCorrelatedPair(table: Table, metrics: ColumnProfile[]): { a: string; b: string; r: number } | null {
  let best: { a: string; b: string; r: number } | null = null;
  for (let i = 0; i < metrics.length; i++)
    for (let j = i + 1; j < metrics.length; j++) {
      const r = pearson(numericColumn(table, metrics[i].name), numericColumn(table, metrics[j].name));
      if (Number.isFinite(r) && (!best || Math.abs(r) > Math.abs(best.r))) best = { a: metrics[i].name, b: metrics[j].name, r };
    }
  return best;
}

// ── On-demand chart builder (the "generate graph" feature) ──────────────────

export interface ChartRequest {
  type: ChartType;
  x: string;
  y: string[];
  aggregate?: boolean;
  count?: boolean;
}

/** Count rows per distinct value of a column (works for string/category columns). */
export function aggregateCount(table: Table, col: string, topN = 15): [string, number][] {
  const acc = new Map<string, number>();
  for (const r of table.rows) {
    const v = r[col];
    if (v === null || v === undefined || v === "") continue;
    const key = String(v);
    acc.set(key, (acc.get(key) ?? 0) + 1);
  }
  return [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
}

/** A side-by-side bar of labeled slices — powers "X vs Y" comparison answers. Values are pre-aggregated. */
export function buildComparisonChart(metricName: string, agg: "sum" | "mean", pairs: [string, number][]): ChartSpec {
  const labels = pairs.map((p) => p[0]);
  const values = pairs.map((p) => p[1]);
  const aggLabel = agg === "mean" ? "average" : "total";
  return {
    id: `chart-compare-${Date.now()}`,
    type: "bar",
    title: `${aggLabel.charAt(0).toUpperCase() + aggLabel.slice(1)} ${metricName}: ${labels.join(" vs ")}`,
    rationale: "Side-by-side comparison of the requested slices.",
    option: {
      ...ANIMATION,
      tooltip: tooltip(),
      grid: grid({ top: 28 }),
      xAxis: categoryAxis(labels, { axisLabel: { color: INK.sub, fontSize: 12, interval: 0, hideOverlap: true } }),
      yAxis: valueAxis({ name: aggLabel }),
      series: [barSeries(values, 1, { label: valueLabel })],
    },
  };
}

/** Stacked-bar cross-tab: x = first dimension's categories, one stacked series per second-dimension
 *  value, heights = the aggregated metric (or counts). Powers the two-dimension breakdown answer. */
export function buildCrossTabChart(
  title: string,
  xCats: string[],
  seriesNames: string[],
  matrix: number[][],
  yName: string
): ChartSpec {
  return {
    id: `chart-crosstab-${Date.now()}`,
    type: "bar",
    title,
    rationale: "A two-dimension breakdown: each bar is split into the contribution of the second dimension.",
    option: {
      ...ANIMATION,
      tooltip: tooltip({ trigger: "axis", axisPointer: { type: "shadow" } }),
      legend: legend({ data: seriesNames, type: "scroll" }),
      grid: grid({ top: 44 }),
      xAxis: categoryAxis(xCats, { axisLabel: { color: INK.sub, fontSize: 11, interval: 0, rotate: xCats.length > 5 ? 22 : 0, hideOverlap: true } }),
      yAxis: valueAxis({ name: yName }),
      series: seriesNames.map((name, i) => barSeries(matrix[i], i, { name, stack: "total" })),
    },
  };
}

function pieOption(pairs: [string, number][]) {
  return {
    ...ANIMATION,
    color: PALETTE,
    tooltip: tooltip({ trigger: "item", formatter: "{b}: {c} ({d}%)" }),
    legend: legend({ top: undefined, bottom: 4, type: "scroll" }),
    series: [{
      type: "pie", radius: ["45%", "72%"], center: ["50%", "46%"], avoidLabelOverlap: true,
      itemStyle: { borderColor: "#0a0e16", borderWidth: 3, borderRadius: 6 },
      label: { color: INK.sub, fontSize: 11, formatter: "{b}\n{d}%" },
      labelLine: { lineStyle: { color: INK.axis } },
      emphasis: { scale: true, scaleSize: 6, label: { color: INK.text, fontWeight: "bold" } },
      data: pairs.map(([name, value]) => ({ name, value })),
    }],
  };
}

/** Build a single chart from an explicit request. Used by the UI chart builder and the NL parser. */
export function buildChart(table: Table, profiles: ColumnProfile[], req: ChartRequest): ChartSpec {
  const id = `chart-custom-${Date.now()}`;
  const xProfile = profiles.find((p) => p.name === req.x);
  const ys = req.y.filter((y) => profiles.some((p) => p.name === y));

  // Safety net: X and Y the same column is meaningless (it just draws a flat/diagonal line).
  // Show the column's distribution instead of a nonsense chart.
  if (req.count !== true && req.type !== "histogram" && ys.length === 1 && ys[0] === req.x) {
    return buildChart(table, profiles, { type: "histogram", x: req.x, y: [req.x] });
  }

  // Count mode: tally rows per value of x. Works for ANY column type (strings included).
  if (req.count === true || ys.length === 0) {
    const pairs = aggregateCount(table, req.x);
    const total = pairs.reduce((s, [, c]) => s + c, 0) || 1;
    const top = pairs[0];
    const sub = top ? `“${top[0]}” most common (${((top[1] / total) * 100).toFixed(0)}%)` : undefined;
    if (req.type === "pie") {
      return { id, type: "pie", title: `Share of ${req.x}`, subtitle: sub, rationale: "Share of rows per value — works for any column type.", option: pieOption(pairs) };
    }
    const isLine = req.type === "line" || req.type === "area";
    return {
      id, type: isLine ? req.type : "bar", title: `Count by ${req.x}`, subtitle: sub,
      rationale: "Counts how often each value occurs — works for strings/categories, not just numbers.",
      option: {
        ...ANIMATION,
        tooltip: tooltip(),
        grid: grid({ top: 28 }),
        xAxis: categoryAxis(pairs.map((p) => p[0]), { boundaryGap: !isLine, axisLabel: { color: INK.sub, fontSize: 11, rotate: pairs.length > 5 ? 28 : 0, interval: 0, hideOverlap: true } }),
        yAxis: valueAxis({ name: "count" }),
        series: [isLine ? lineSeries("count", pairs.map((p) => p[1]), 1, { area: req.type === "area" }) : barSeries(pairs.map((p) => p[1]), 1, { label: valueLabel })],
      },
    };
  }

  if (req.type === "pie") {
    return { id, type: "pie", title: `${ys[0]} by ${req.x}`, rationale: "Composition of a metric across categories.", option: pieOption(aggregateBy(table, req.x, ys[0])) };
  }

  if (req.type === "histogram") {
    const vals = numericColumn(table, ys[0] ?? req.x).filter(Number.isFinite);
    const bins = histogram(vals, 20);
    return {
      id, type: "histogram", title: `Distribution of ${ys[0] ?? req.x}`, rationale: "Frequency distribution of a single metric.",
      option: {
        ...ANIMATION,
        tooltip: tooltip(),
        grid: grid({ top: 24 }),
        xAxis: categoryAxis(bins.map((b) => b.label), { axisLabel: { color: INK.faint, fontSize: 10, interval: 3 } }),
        yAxis: valueAxis(),
        series: [{ type: "bar", data: bins.map((b) => b.count), barCategoryGap: "2%", itemStyle: { color: vGradient(color(4)), borderRadius: [3, 3, 0, 0] } }],
      },
    };
  }

  if (req.type === "scatter") {
    const xs = numericColumn(table, req.x);
    const yy = numericColumn(table, ys[0]);
    const data = xs.map((x, i) => [x, yy[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    return { id, type: "scatter", title: `${req.x} vs ${ys[0]}`, rationale: "Relationship between two metrics.", option: scatterOption(req.x, ys[0], data) };
  }

  // line / bar / area
  const isTime = xProfile?.role === "time";
  const order = isTime ? sortByTime(table, req.x) : table.rows.map((_, i) => i);
  let categories: string[];
  let series: Record<string, unknown>[];

  if (req.type === "bar" && req.aggregate !== false && xProfile?.role === "dimension") {
    const pairs = aggregateBy(table, req.x, ys[0]);
    categories = pairs.map((p) => p[0]);
    series = [barSeries(pairs.map((p) => p[1]), 0, { name: ys[0], label: valueLabel })];
  } else {
    categories = axisLabels(table, req.x, order);
    series = ys.map((y, i) => {
      const col = numericColumn(table, y);
      const dataArr = order.map((idx) => col[idx]);
      return req.type === "bar"
        ? barSeries(dataArr, i, { name: y })
        : lineSeries(y, dataArr, i, { area: req.type === "area" });
    });
  }

  return {
    id, type: req.type, title: `${ys.join(", ")} by ${req.x}`, rationale: "Custom chart you requested.",
    option: {
      ...ANIMATION,
      color: PALETTE,
      tooltip: tooltip(),
      legend: ys.length > 1 ? legend() : undefined,
      grid: grid({ top: ys.length > 1 ? 44 : 28 }),
      xAxis: categoryAxis(categories, { boundaryGap: req.type === "bar", axisLabel: { color: INK.sub, fontSize: 11, rotate: categories.length > 8 ? 28 : 0, hideOverlap: true } }),
      yAxis: valueAxis(),
      series,
    },
  };
}

function histogram(xs: number[], binCount: number): { label: string; count: number }[] {
  if (xs.length === 0) return [];
  const min = minOf(xs);
  const max = maxOf(xs);
  if (min === max) return [{ label: min.toFixed(1), count: xs.length }];
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({ label: (min + i * width).toFixed(1), count: 0 }));
  for (const x of xs) {
    const bi = Math.min(binCount - 1, Math.floor((x - min) / width));
    bins[bi].count++;
  }
  return bins;
}
