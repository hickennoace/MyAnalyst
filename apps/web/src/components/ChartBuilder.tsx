"use client";

import { useMemo, useState } from "react";
import type { ChartSpec, ChartType, ColumnProfile, Table } from "@/lib/types";
import { buildChart, type ChartRequest } from "@/lib/charts";
import { parseChartRequest } from "@/lib/nl-chart";
import { useT } from "@/lib/i18n";
import { Chart } from "./Chart";

const CHART_TYPES: ChartType[] = ["line", "bar", "area", "scatter", "pie", "histogram"];

// The "generate graph if the user wants" feature. Two ways in:
//   1. Ask in plain English ("revenue by region as a bar chart") -> nl-chart parser.
//   2. Pick columns + type manually.
export function ChartBuilder({ table, profiles }: { table: Table; profiles: ColumnProfile[] }) {
  const t = useT();
  const metrics = useMemo(() => profiles.filter((p) => p.role === "metric"), [profiles]);
  const dimsAndTime = useMemo(
    () => profiles.filter((p) => p.role === "time" || p.role === "dimension" || p.role === "metric"),
    [profiles]
  );

  const [prompt, setPrompt] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [custom, setCustom] = useState<ChartSpec[]>([]);

  // Manual controls. "__count__" is a synthetic measure = count rows per x (works for any column type).
  const COUNT = "__count__";
  const [type, setType] = useState<ChartType>("bar");
  const [x, setX] = useState<string>(dimsAndTime[0]?.name ?? profiles[0]?.name ?? "");
  const [y, setY] = useState<string>(metrics[0]?.name ?? COUNT);

  function addSpec(spec: ChartSpec) {
    setCustom((c) => [spec, ...c]);
  }

  function handleAsk() {
    const res = parseChartRequest(prompt, profiles);
    setNote(res.message);
    if (res.request) addSpec(buildChart(table, profiles, res.request));
  }

  function handleManual() {
    if (y !== COUNT && type !== "histogram" && x === y) {
      setNote(t.builder.sameCol);
      return;
    }
    const req: ChartRequest =
      y === COUNT
        ? { type, x, y: [], count: true }
        : { type, x, y: [y], aggregate: true };
    addSpec(buildChart(table, profiles, req));
    setNote(null);
  }

  return (
    <section className="space-y-4">
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-100">{t.builder.title}</h3>
        <p className="mt-1 text-xs text-slate-400">{t.builder.desc}</p>

        {/* Natural language */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder={`e.g. "${metrics[0]?.name ?? "value"} by ${dimsAndTime.find((d) => d.role !== "metric")?.name ?? "category"}"`}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
          />
          <button
            onClick={handleAsk}
            className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            ✨ {t.builder.generate}
          </button>
        </div>

        {/* Manual controls */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label={t.builder.chartType}>
            <select value={type} onChange={(e) => setType(e.target.value as ChartType)} className={selectCls}>
              {CHART_TYPES.map((ct) => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>
          </Field>
          <Field label={type === "scatter" ? t.builder.xMetric : t.builder.xAxis}>
            <select value={x} onChange={(e) => setX(e.target.value)} className={selectCls}>
              {(type === "scatter" ? metrics : dimsAndTime).map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label={type === "histogram" ? t.builder.metric : t.builder.measure}>
            <select value={y} onChange={(e) => setY(e.target.value)} className={selectCls}>
              <option value={COUNT}>{t.builder.countRows}</option>
              {metrics.filter((p) => p.name !== x).map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button
              onClick={handleManual}
              className="w-full rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60"
            >
              {t.builder.addChart}
            </button>
          </div>
        </div>

        {note && <p className="mt-3 text-xs text-blue-300">{note}</p>}
      </div>

      {custom.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {custom.map((spec) => (
            <Chart key={spec.id} spec={spec} />
          ))}
        </div>
      )}
    </section>
  );
}

const selectCls =
  "w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 focus:border-blue-400 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
