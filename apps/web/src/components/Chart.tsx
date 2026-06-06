"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import type { ChartSpec } from "@/lib/types";

// ECharts is client-only and heavy; load it lazily so it never runs during SSR.
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface EChartsInstance {
  getDataURL(opts: { type: string; pixelRatio: number; backgroundColor: string }): string;
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

  // Export the chart WITH its title/subtitle composited on top (ECharts' own PNG omits the DOM heading).
  async function downloadPng() {
    const inst = instance.current;
    if (!inst) return;
    const ratio = 2;
    const chartUrl = inst.getDataURL({ type: "png", pixelRatio: ratio, backgroundColor: "#0b0f1a" });
    const img = await loadImage(chartUrl);

    const headerH = (spec.subtitle ? 52 : 34) * ratio;
    const padX = 18 * ratio;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height + headerH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = "top";
    ctx.fillStyle = "#f1f5f9";
    ctx.font = `600 ${15 * ratio}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.fillText(spec.title, padX, 12 * ratio);
    if (spec.subtitle) {
      ctx.fillStyle = "#94a3b8";
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
            className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
          >
            ⬇ PNG
          </button>
          <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
            {spec.type}
          </span>
        </div>
      </div>
      <ReactECharts
        option={spec.option}
        style={{ height: 320, width: "100%" }}
        opts={{ renderer: "canvas" }}
        onChartReady={(inst: unknown) => {
          instance.current = inst as EChartsInstance;
        }}
        notMerge
      />
      <p className="mt-2 text-xs text-slate-500">{spec.rationale}</p>
    </div>
  );
}
