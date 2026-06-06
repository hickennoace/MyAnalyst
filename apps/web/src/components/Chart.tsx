"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import type { ChartSpec } from "@/lib/types";

// ECharts is client-only and heavy; load it lazily so it never runs during SSR.
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

// Minimal shape of the ECharts instance we use for per-chart export.
interface EChartsInstance {
  getDataURL(opts: { type: string; pixelRatio: number; backgroundColor: string }): string;
}

export function Chart({ spec }: { spec: ChartSpec }) {
  const instance = useRef<EChartsInstance | null>(null);

  function downloadPng() {
    const inst = instance.current;
    if (!inst) return;
    const url = inst.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#0b0f1a" });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${spec.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{spec.title}</h3>
          {spec.subtitle && <p className="text-xs text-slate-400">{spec.subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadPng}
            title="Download this chart as PNG"
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
