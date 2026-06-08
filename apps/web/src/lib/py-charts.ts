import type { ChartSpec } from "./types";
import type { PyChart } from "./py-engine";
import {
  ANIMATION, INK, PALETTE, barSeries, categoryAxis, color, grid, legend, lineSeries, tooltip, valueAxis,
} from "./chart-theme";

// Turn the data-only charts the Python engine returns ({type, x, series, matrix, points}) into the same
// styled ECharts `ChartSpec` the existing <Chart> component renders. Keeps the BI-tool look identical
// whether the analysis came from the TS or the Python engine.

export function pyChartToSpec(c: PyChart): ChartSpec | null {
  switch (c.type) {
    case "line":
      return line(c);
    case "bar":
      return bar(c);
    case "heatmap":
      return heatmap(c);
    case "scatter":
      return scatter(c);
    default:
      return null;
  }
}

export function pyChartsToSpecs(charts: PyChart[]): ChartSpec[] {
  return charts.map(pyChartToSpec).filter((s): s is ChartSpec => s !== null);
}

function base(c: PyChart, option: Record<string, unknown>): ChartSpec {
  return { id: c.id, type: c.type, title: c.title, subtitle: c.subtitle, rationale: "", option };
}

function line(c: PyChart): ChartSpec | null {
  if (!c.x || !c.series?.length) return null;
  const multi = c.series.length > 1;
  const series = c.series.map((s, i) => lineSeries(s.name, s.values, i, { area: c.series!.length === 1 }));
  return base(c, {
    ...ANIMATION,
    color: PALETTE,
    tooltip: tooltip(),
    legend: multi ? legend({ data: c.series.map((s) => s.name) }) : undefined,
    grid: grid({ top: multi ? 44 : 24 }),
    xAxis: categoryAxis(c.x, { boundaryGap: false }),
    yAxis: valueAxis(),
    series,
  });
}

function bar(c: PyChart): ChartSpec | null {
  if (!c.x || !c.series?.length) return null;
  const multi = c.series.length > 1;
  const series = c.series.map((s, i) => barSeries(s.values.map((v) => v ?? 0), i));
  return base(c, {
    ...ANIMATION,
    color: PALETTE,
    tooltip: tooltip(),
    legend: multi ? legend({ data: c.series.map((s) => s.name) }) : undefined,
    grid: grid({ top: multi ? 44 : 28 }),
    xAxis: categoryAxis(c.x, { axisLabel: { color: INK.sub, fontSize: 11, rotate: c.x.length > 6 ? 28 : 0, hideOverlap: true } }),
    yAxis: valueAxis(),
    series,
  });
}

function heatmap(c: PyChart): ChartSpec | null {
  if (!c.x || !c.matrix) return null;
  const labels = c.x;
  const data: [number, number, number][] = [];
  let lo = Infinity;
  let hi = -Infinity;
  c.matrix.forEach((row, i) =>
    row.forEach((v, j) => {
      if (v === null || !Number.isFinite(v)) return;
      data.push([j, i, v]);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    })
  );
  return base(c, {
    ...ANIMATION,
    tooltip: { trigger: "item" },
    grid: grid({ top: 24, left: 80, bottom: 60 }),
    xAxis: { type: "category", data: labels, axisLabel: { color: INK.sub, fontSize: 10, rotate: 30 } },
    yAxis: { type: "category", data: labels, axisLabel: { color: INK.sub, fontSize: 10 } },
    visualMap: {
      min: Number.isFinite(lo) ? lo : -1, max: Number.isFinite(hi) ? hi : 1,
      calculable: true, orient: "horizontal", left: "center", bottom: 0,
      inRange: { color: [color(2), "#1e293b", color(0)] }, textStyle: { color: INK.sub },
    },
    series: [{ type: "heatmap", data, label: { show: false }, emphasis: { itemStyle: { borderColor: "#fff", borderWidth: 1 } } }],
  });
}

function scatter(c: PyChart): ChartSpec | null {
  if (!c.points?.length) return null;
  return base(c, {
    ...ANIMATION,
    tooltip: { trigger: "item" },
    grid: grid({ top: 24, left: 24 }),
    xAxis: valueAxis(),
    yAxis: valueAxis(),
    series: [{
      type: "scatter", data: c.points, symbolSize: 8,
      itemStyle: { color: color(0), opacity: 0.6, borderColor: color(0), borderWidth: 1 },
    }],
  });
}
