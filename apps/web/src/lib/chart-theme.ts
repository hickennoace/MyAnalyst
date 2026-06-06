// Shared chart theme — gives every ECharts chart a polished, consistent "BI tool" look
// (gradient fills, rounded bars, soft gridlines, refined tooltips, smooth animation).
// All chart builders compose their options from these helpers so styling stays uniform.

/** Curated categorical palette — leads with the brand azure/cyan, then a
 *  harmonious spread that stays legible on the midnight-navy canvas. */
export const PALETTE = [
  "#3d8bff", "#5fd2e0", "#5AD8A6", "#F6BD16", "#E8684A",
  "#9270CA", "#FF9D4D", "#269A99", "#FF99C3", "#7b8aa8",
];

export const INK = {
  text: "#e6ebf2",
  sub: "#8b94a6",
  faint: "#59617a",
  grid: "#16202e",
  axis: "#243144",
};

const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Vertical gradient (top → bottom) for bars/areas. */
export function vGradient(color: string, topA = 0.95, bottomA = 0.35) {
  return {
    type: "linear",
    x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: hexToRgba(color, topA) },
      { offset: 1, color: hexToRgba(color, bottomA) },
    ],
  };
}

export function color(i: number): string {
  return PALETTE[i % PALETTE.length];
}

export function grid(extra: Record<string, unknown> = {}) {
  return { left: 16, right: 24, top: 44, bottom: 24, containLabel: true, ...extra };
}

export function tooltip(extra: Record<string, unknown> = {}) {
  return {
    trigger: "axis",
    backgroundColor: "rgba(13, 18, 32, 0.93)",
    borderColor: "rgba(139, 148, 166, 0.25)",
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: INK.text, fontFamily: FONT, fontSize: 12 },
    extraCssText: "border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.35);",
    axisPointer: { type: "shadow", shadowStyle: { color: "rgba(148,163,184,0.08)" } },
    ...extra,
  };
}

export function legend(extra: Record<string, unknown> = {}) {
  return {
    top: 6,
    icon: "roundRect",
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 16,
    textStyle: { color: INK.sub, fontFamily: FONT, fontSize: 12 },
    ...extra,
  };
}

export function categoryAxis(data: string[], extra: Record<string, unknown> = {}) {
  return {
    type: "category",
    data,
    boundaryGap: true,
    axisLine: { lineStyle: { color: INK.axis } },
    axisTick: { show: false },
    axisLabel: { color: INK.sub, fontFamily: FONT, fontSize: 11, hideOverlap: true },
    ...extra,
  };
}

export function valueAxis(extra: Record<string, unknown> = {}) {
  return {
    type: "value",
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: INK.sub, fontFamily: FONT, fontSize: 11 },
    splitLine: { lineStyle: { color: INK.grid, type: "dashed" } },
    ...extra,
  };
}

/** A styled bar series with gradient fill + rounded top + emphasis. */
export function barSeries(data: number[], colorIdx = 0, extra: Record<string, unknown> = {}) {
  const c = color(colorIdx);
  return {
    type: "bar",
    data,
    barMaxWidth: 48,
    itemStyle: { color: vGradient(c), borderRadius: [6, 6, 0, 0] },
    emphasis: { itemStyle: { color: vGradient(c, 1, 0.55) } },
    ...extra,
  };
}

/** A styled line series with optional gradient area + soft glow. */
export function lineSeries(
  name: string,
  data: (number | null)[],
  colorIdx = 0,
  opts: { area?: boolean; dashed?: boolean } = {}
) {
  const c = color(colorIdx);
  return {
    name,
    type: "line",
    data,
    smooth: 0.35,
    showSymbol: false,
    symbol: "circle",
    symbolSize: 7,
    sampling: "lttb",
    lineStyle: { width: 2.5, color: c, type: opts.dashed ? "dashed" : "solid", cap: "round" },
    itemStyle: { color: c, borderColor: "#0a0e16", borderWidth: 2 },
    emphasis: { focus: "series" },
    areaStyle: opts.area ? { color: vGradient(c, 0.28, 0.01) } : undefined,
  };
}

export const ANIMATION = {
  animation: true,
  animationDuration: 700,
  animationEasing: "cubicOut",
};

export { hexToRgba };
