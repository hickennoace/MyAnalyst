"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { ChartSpec } from "@/lib/types";
import { chartBg } from "@/lib/chart-theme";
import { ErrorBoundary } from "./ErrorBoundary";

// ECharts is client-only and heavy; load it lazily so it never runs during SSR.
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface EChartsInstance {
  getDataURL(opts: { type: string; pixelRatio: number; backgroundColor: string }): string;
  resize(): void;
}

function safeName(s: string): string {
  return (s.replace(/[^a-z0-9-_ ]+/gi, "").trim().replace(/\s+/g, "-") || "chart").slice(0, 60);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function Chart({ spec }: { spec: ChartSpec }) {
  const instance = useRef<EChartsInstance | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // echarts-for-react@3 binds no resize listener of its own, so keep the canvas in step with its
  // container width (responsive layouts, window resizes) via a ResizeObserver. Inactive tab panels stay
  // laid out (clipped, not display:none), so charts always initialise at the right width - no tab-switch
  // resize dance needed.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0) instance.current?.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Export the chart WITH its title/subtitle composited on top (ECharts' own PNG omits the DOM heading).
  async function downloadPng() {
    const inst = instance.current;
    if (!inst) return;
    const ratio = 2;
    const bg = chartBg();
    const light = bg === "#ffffff";
    const chartUrl = inst.getDataURL({ type: "png", pixelRatio: ratio, backgroundColor: bg });
    const img = await loadImage(chartUrl);

    const headerH = (spec.subtitle ? 52 : 34) * ratio;
    const padX = 18 * ratio;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height + headerH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = "top";
    ctx.fillStyle = light ? "#111318" : "#f1f5f9";
    ctx.font = `600 ${15 * ratio}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.fillText(spec.title, padX, 12 * ratio);
    if (spec.subtitle) {
      ctx.fillStyle = light ? "#565b66" : "#94a3b8";
      ctx.font = `${12 * ratio}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(spec.subtitle, padX, 32 * ratio);
    }
    ctx.drawImage(img, 0, headerH);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${safeName(spec.title)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="card card-hover p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{spec.title}</h3>
          {spec.subtitle && <p className="text-xs text-slate-400">{spec.subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadPng}
            title="Download this chart as PNG (with its title)"
            aria-label={`Download chart "${spec.title}" as PNG`}
            className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
          >
            ⬇ PNG
          </button>
          <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
            {spec.type}
          </span>
        </div>
      </div>
      <ErrorBoundary
        label="chart"
        fallback={() => (
          <div className="grid h-[320px] place-items-center rounded-lg border border-slate-800 bg-slate-900/40 text-center text-xs text-slate-500">
            This chart couldn&apos;t be rendered.
          </div>
        )}
      >
        {/* The ECharts canvas is invisible to screen readers; describe it as an image. */}
        <div ref={wrapRef} role="img" aria-label={`${spec.type} chart: ${spec.title}${spec.subtitle ? ` - ${spec.subtitle}` : ""}`}>
          <ReactECharts
            option={spec.option}
            style={{ height: 320, width: "100%" }}
            opts={{ renderer: "canvas" }}
            onChartReady={(inst: unknown) => {
              instance.current = inst as EChartsInstance;
            }}
            notMerge
          />
        </div>
      </ErrorBoundary>
    </div>
  );
}
