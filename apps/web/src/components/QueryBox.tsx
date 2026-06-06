"use client";

import { useMemo, useState } from "react";
import type { ColumnProfile, Table } from "@/lib/types";
import { answerQuestion, type QueryAnswer } from "@/lib/query";
import { Chart } from "./Chart";

// "Ask your data" box. Heuristic Q&A over the local dataset — no LLM, no key. Answers with the real
// computed numbers and an optional chart.

export function QueryBox({ table, profiles }: { table: Table; profiles: ColumnProfile[] }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<QueryAnswer | null>(null);

  const suggestions = useMemo(() => buildSuggestions(profiles), [profiles]);

  function ask(question: string) {
    setQ(question);
    setResult(answerQuestion(question, table, profiles));
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-100">Ask your data</h3>
      <p className="mt-1 text-xs text-slate-400">
        Plain-English questions, answered with your real numbers. Runs locally — no AI key needed.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(q)}
          placeholder={suggestions[0] ?? "e.g. total revenue by region"}
          aria-label="Ask a question about your data"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
        />
        <button
          onClick={() => ask(q)}
          className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Ask
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-blue-500/50 hover:text-blue-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="mt-4" aria-live="polite">
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              result.ok ? "border-blue-500/30 bg-blue-500/10 text-slate-100" : "border-slate-700 bg-slate-800/40 text-slate-300"
            }`}
          >
            {result.ok ? "💡 " : "🤔 "}
            {result.answer}
          </div>
          {result.chart && (
            <div className="mt-4">
              <Chart spec={result.chart} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function buildSuggestions(profiles: ColumnProfile[]): string[] {
  const metrics = profiles.filter((p) => p.role === "metric" && p.numeric);
  const dims = profiles.filter((p) => p.role === "dimension");
  const time = profiles.find((p) => p.role === "time");
  const out: string[] = [];
  if (metrics[0]) out.push(`total ${metrics[0].name}`);
  if (metrics[0] && dims[0]) out.push(`average ${metrics[0].name} by ${dims[0].name}`);
  if (dims[0] && metrics[0]) out.push(`which ${dims[0].name} has the highest ${metrics[0].name}`);
  if (metrics.length >= 2) out.push(`correlation between ${metrics[0].name} and ${metrics[1].name}`);
  if (time && metrics[0]) out.push(`how did ${metrics[0].name} change over time`);
  return out.slice(0, 5);
}
