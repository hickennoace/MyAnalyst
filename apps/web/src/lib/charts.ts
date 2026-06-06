import type { ChartSpec, ChartType, ColumnProfile, Table } from "./types";
import { numericColumn } from "./profile";
import { pearson } from "./stats";
import { primaryMetric, sortByTime } from "./kpi";
import { defaultHorizon, holtForecast } from "./forecast";

// Chart engine. Two entry points:
//   - recommendCharts(): the engine auto-picks charts from data shape (no user input).
//   - buildChart(): construct a specific chart on demand (the "generate graph" feature).
// Both emit ready-to-render ECharts `option` objects.

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16"];

const baseGrid = { left: 48, right: 24, top: 48, bottom: 56, containLabel: true };

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

// ── Auto-recommendation ────────────────────────────────────────────────────

export function recommendCharts(table: Table, profiles: ColumnProfile[]): ChartSpec[] {
  const charts: ChartSpec[] = [];
  const time = profiles.find((p) => p.role === "time");
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  const dims = profiles.filter((p) => p.role === "dimension");

  // 1. Time series line for each metric (when there's a time axis).
  if (time && metrics.length) {
    const order = sortByTime(table, time.name);
    const x = axisLabels(table, time.name, order);
    const series = metrics.slice(0, 4).map((m, i) => ({
      name: m.name,
      type: "line",
      smooth: true,
      showSymbol: false,
      data: order.map((idx) => numericColumn(table, m.name)[idx]),
      lineStyle: { width: 2, color: PALETTE[i % PALETTE.length] },
      itemStyle: { color: PALETTE[i % PALETTE.length] },
      areaStyle: metrics.length === 1 ? { opacity: 0.08 } : undefined,
    }));
    charts.push({
      id: "chart-timeseries",
      type: "line",
      title: `${metrics.slice(0, 4).map((m) => m.name).join(", ")} over ${time.name}`,
      rationale: "A time column plus numeric metrics → trend over time.",
      option: {
        color: PALETTE,
        tooltip: { trigger: "axis" },
        legend: { top: 8, textStyle: { color: "#94a3b8" } },
        grid: baseGrid,
        xAxis: { type: "category", data: x, axisLabel: { color: "#94a3b8" } },
        yAxis: { type: "value", axisLabel: { color: "#94a3b8" }, splitLine: { lineStyle: { color: "#1e293b" } } },
        series,
      },
    });
  }

  // 2. Bar of a metric by the strongest categorical dimension.
  if (dims.length && metrics.length) {
    const dim = dims[0];
    const metric = metrics[0];
    const pairs = aggregateBy(table, dim.name, metric.name);
    if (pairs.length >= 2) {
      charts.push({
        id: "chart-bar-by-dim",
        type: "bar",
        title: `${metric.name} by ${dim.name}`,
        rationale: "A category column plus a metric → comparison across groups.",
        option: {
          tooltip: { trigger: "axis" },
          grid: baseGrid,
          xAxis: { type: "category", data: pairs.map((p) => p[0]), axisLabel: { color: "#94a3b8", rotate: pairs.length > 6 ? 30 : 0 } },
          yAxis: { type: "value", axisLabel: { color: "#94a3b8" }, splitLine: { lineStyle: { color: "#1e293b" } } },
          series: [{ type: "bar", data: pairs.map((p) => p[1]), itemStyle: { color: PALETTE[0], borderRadius: [4, 4, 0, 0] } }],
        },
      });
    }
  }

  // 2b. Forecast of the primary metric when there's a long-enough time series.
  if (time) {
    const fc = forecastChart(table, profiles, time);
    if (fc) charts.push(fc);
  }

  // 3. Correlation heatmap when there are several metrics.
  if (metrics.length >= 3) {
    charts.push(correlationHeatmap(table, metrics));
  }

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
        option: {
          tooltip: { trigger: "item" },
          grid: baseGrid,
          xAxis: { type: "value", name: best.a, axisLabel: { color: "#94a3b8" }, splitLine: { lineStyle: { color: "#1e293b" } } },
          yAxis: { type: "value", name: best.b, axisLabel: { color: "#94a3b8" }, splitLine: { lineStyle: { color: "#1e293b" } } },
          series: [{ type: "scatter", data, symbolSize: 8, itemStyle: { color: PALETTE[3], opacity: 0.7 } }],
        },
      });
    }
  }

  return charts;
}

function forecastChart(table: Table, profiles: ColumnProfile[], time: ColumnProfile): ChartSpec | null {
  const pm = primaryMetric(profiles);
  if (!pm) return null;
  const order = sortByTime(table, time.name);
  const values = numericColumn(table, pm.name);
  const series = order.map((i) => values[i]).filter(Number.isFinite);
  if (series.length < 6) return null;

  const horizon = defaultHorizon(series.length);
  const fc = holtForecast(series, horizon);
  if (!fc) return null;

  const histLabels = order.map((i) => String(table.rows[i][time.name] ?? ""));
  const forecastLabels = Array.from({ length: horizon }, (_, h) => `+${h + 1}`);
  const x = [...histLabels, ...forecastLabels];

  const actual: (number | null)[] = [...series, ...Array(horizon).fill(null)];
  // Forecast line starts at the last actual point so the dashed segment connects.
  const projected: (number | null)[] = [
    ...Array(series.length - 1).fill(null),
    series[series.length - 1],
    ...fc.forecast,
  ];

  return {
    id: "chart-forecast",
    type: "line",
    title: `${pm.name} forecast (+${horizon} periods)`,
    subtitle: `Holt's linear trend · α=${fc.alpha}, β=${fc.beta}`,
    rationale: "A long-enough time series → a short forward projection of the primary metric.",
    option: {
      color: [PALETTE[0], PALETTE[2]],
      tooltip: { trigger: "axis" },
      legend: { top: 8, textStyle: { color: "#94a3b8" }, data: ["actual", "forecast"] },
      grid: baseGrid,
      xAxis: { type: "category", data: x, axisLabel: { color: "#94a3b8" } },
      yAxis: { type: "value", axisLabel: { color: "#94a3b8" }, splitLine: { lineStyle: { color: "#1e293b" } } },
      series: [
        { name: "actual", type: "line", smooth: true, showSymbol: false, data: actual, lineStyle: { width: 2 } },
        {
          name: "forecast",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: projected,
          lineStyle: { width: 2, type: "dashed" },
          areaStyle: { opacity: 0.06 },
        },
      ],
    },
  };
}

function correlationHeatmap(table: Table, metrics: ColumnProfile[]): ChartSpec {
  const cols = metrics.slice(0, 8).map((m) => m.name);
  const data: [number, number, number][] = [];
  for (let i = 0; i < cols.length; i++) {
    for (let j = 0; j < cols.length; j++) {
      const r = i === j ? 1 : pearson(numericColumn(table, cols[i]), numericColumn(table, cols[j]));
      data.push([j, i, Number.isFinite(r) ? Number(r.toFixed(2)) : 0]);
    }
  }
  return {
    id: "chart-corr",
    type: "heatmap",
    title: "Correlation matrix",
    rationale: "Several numeric metrics → pairwise correlation strength at a glance.",
    option: {
      tooltip: { position: "top" },
      grid: { ...baseGrid, bottom: 80 },
      xAxis: { type: "category", data: cols, axisLabel: { color: "#94a3b8", rotate: 30 }, splitArea: { show: true } },
      yAxis: { type: "category", data: cols, axisLabel: { color: "#94a3b8" }, splitArea: { show: true } },
      visualMap: {
        min: -1, max: 1, calculable: true, orient: "horizontal", left: "center", bottom: 0,
        inRange: { color: ["#ef4444", "#0f172a", "#10b981"] }, textStyle: { color: "#94a3b8" },
      },
      series: [{ type: "heatmap", data, label: { show: true, color: "#e2e8f0" } }],
    },
  };
}

function mostCorrelatedPair(table: Table, metrics: ColumnProfile[]): { a: string; b: string; r: number } | null {
  let best: { a: string; b: string; r: number } | null = null;
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const r = pearson(numericColumn(table, metrics[i].name), numericColumn(table, metrics[j].name));
      if (Number.isFinite(r) && (!best || Math.abs(r) > Math.abs(best.r)))
        best = { a: metrics[i].name, b: metrics[j].name, r };
    }
  }
  return best;
}

// ── On-demand chart builder (the "generate graph" feature) ──────────────────

export interface ChartRequest {
  type: ChartType;
  /** x axis / dimension / time column */
  x: string;
  /** y axis / metric column(s) */
  y: string[];
  /** for bar/pie: aggregate y by x (sum). Ignored for scatter/line-over-time. */
  aggregate?: boolean;
}

/** Build a single chart from an explicit request. Used by the UI chart builder and the NL parser. */
export function buildChart(table: Table, profiles: ColumnProfile[], req: ChartRequest): ChartSpec {
  const id = `chart-custom-${Date.now()}`;
  const xProfile = profiles.find((p) => p.name === req.x);
  const ys = req.y.filter((y) => profiles.some((p) => p.name === y));

  if (req.type === "pie") {
    const pairs = aggregateBy(table, req.x, ys[0]);
    return {
      id, type: "pie", title: `${ys[0]} by ${req.x}`,
      rationale: "Composition of a metric across categories.",
      option: {
        color: PALETTE,
        tooltip: { trigger: "item" },
        legend: { bottom: 0, textStyle: { color: "#94a3b8" } },
        series: [{
          type: "pie", radius: ["40%", "70%"], center: ["50%", "45%"],
          data: pairs.map(([name, value]) => ({ name, value })),
          label: { color: "#cbd5e1" },
        }],
      },
    };
  }

  if (req.type === "histogram") {
    const vals = numericColumn(table, ys[0] ?? req.x).filter(Number.isFinite);
    const bins = histogram(vals, 20);
    return {
      id, type: "histogram", title: `Distribution of ${ys[0] ?? req.x}`,
      rationale: "Frequency distribution of a single metric.",
      option: {
        tooltip: { trigger: "axis" },
        grid: baseGrid,
        xAxis: { type: "category", data: bins.map((b) => b.label), axisLabel: { color: "#94a3b8" } },
        yAxis: { type: "value", axisLabel: { color: "#94a3b8" }, splitLine: { lineStyle: { color: "#1e293b" } } },
        series: [{ type: "bar", data: bins.map((b) => b.count), itemStyle: { color: PALETTE[4], borderRadius: [3, 3, 0, 0] } }],
      },
    };
  }

  if (req.type === "scatter") {
    const xs = numericColumn(table, req.x);
    const yy = numericColumn(table, ys[0]);
    const data = xs.map((x, i) => [x, yy[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    return {
      id, type: "scatter", title: `${req.x} vs ${ys[0]}`,
      rationale: "Relationship between two metrics.",
      option: {
        tooltip: { trigger: "item" },
        grid: baseGrid,
        xAxis: { type: "value", name: req.x, axisLabel: { color: "#94a3b8" }, splitLine: { lineStyle: { color: "#1e293b" } } },
        yAxis: { type: "value", name: ys[0], axisLabel: { color: "#94a3b8" }, splitLine: { lineStyle: { color: "#1e293b" } } },
        series: [{ type: "scatter", data, symbolSize: 8, itemStyle: { color: PALETTE[2], opacity: 0.7 } }],
      },
    };
  }

  // line / bar / area
  const isTime = xProfile?.role === "time";
  const order = isTime ? sortByTime(table, req.x) : table.rows.map((_, i) => i);
  let categories: string[];
  let series: Record<string, unknown>[];

  if ((req.type === "bar") && req.aggregate !== false && xProfile?.role === "dimension") {
    const pairs = aggregateBy(table, req.x, ys[0]);
    categories = pairs.map((p) => p[0]);
    series = [{ name: ys[0], type: "bar", data: pairs.map((p) => p[1]), itemStyle: { color: PALETTE[0], borderRadius: [4, 4, 0, 0] } }];
  } else {
    categories = axisLabels(table, req.x, order);
    series = ys.map((y, i) => ({
      name: y,
      type: req.type === "area" ? "line" : req.type,
      smooth: req.type !== "bar",
      showSymbol: false,
      areaStyle: req.type === "area" ? { opacity: 0.12 } : undefined,
      data: order.map((idx) => numericColumn(table, y)[idx]),
      itemStyle: { color: PALETTE[i % PALETTE.length] },
      lineStyle: { width: 2 },
    }));
  }

  return {
    id, type: req.type, title: `${ys.join(", ")} by ${req.x}`,
    rationale: "Custom chart you requested.",
    option: {
      color: PALETTE,
      tooltip: { trigger: "axis" },
      legend: ys.length > 1 ? { top: 8, textStyle: { color: "#94a3b8" } } : undefined,
      grid: baseGrid,
      xAxis: { type: "category", data: categories, axisLabel: { color: "#94a3b8", rotate: categories.length > 8 ? 30 : 0 } },
      yAxis: { type: "value", axisLabel: { color: "#94a3b8" }, splitLine: { lineStyle: { color: "#1e293b" } } },
      series,
    },
  };
}

function histogram(xs: number[], binCount: number): { label: string; count: number }[] {
  if (xs.length === 0) return [];
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  if (min === max) return [{ label: min.toFixed(1), count: xs.length }];
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    label: (min + i * width).toFixed(1),
    count: 0,
  }));
  for (const x of xs) {
    const bi = Math.min(binCount - 1, Math.floor((x - min) / width));
    bins[bi].count++;
  }
  return bins;
}
