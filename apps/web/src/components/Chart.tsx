"use client";

import dynamic from "next/dynamic";
import type { ChartSpec } from "@/lib/types";

// ECharts is client-only and heavy; load it lazily so it never runs during SSR.
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export function Chart({ spec }: { spec: ChartSpec }) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{spec.title}</h3>
          {spec.subtitle && <p className="text-xs text-slate-400">{spec.subtitle}</p>}
        </div>
        <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
          {spec.type}
        </span>
      </div>
      <ReactECharts
        option={spec.option}
        style={{ height: 320, width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge
      />
      <p className="mt-2 text-xs text-slate-500">{spec.rationale}</p>
    </div>
  );
}
