"use client";

import { useMemo, useRef, useState } from "react";
import type { ColumnProfile, Table } from "@/lib/types";
import { answerQuestionAI, type QaTurn, type RichAnswer } from "@/lib/query";
import { llmEnabled } from "@/lib/insights/humanize";
import { Chart } from "./Chart";

// "Ask your data" box. Computes the exact numbers locally, then — when the optional LLM is enabled —
// has it narrate a thorough, professional analyst answer grounded in those numbers (raw rows never
// leave the page). Without a key it answers from the local heuristic engine. Either way the numbers
// are real and the dashboard never breaks. Answers stack into a conversation, so follow-ups read as
// a real back-and-forth (and the model gets the recent turns as context).

interface Turn {
  id: number;
  q: string;
  result: RichAnswer | null; // null while the answer is in flight
}

export function QueryBox({
  table,
  profiles,
  domain,
}: {
  table: Table;
  profiles: ColumnProfile[];
  domain?: string;
}) {
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const idRef = useRef(0);
  const ai = useMemo(() => llmEnabled(), []);

  const suggestions = useMemo(() => buildSuggestions(profiles), [profiles]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || loading) return;
    const id = ++idRef.current;
    // Recent completed LLM turns become conversation context for follow-ups ("why?", "compare that").
    const history: QaTurn[] = turns
      .filter((t) => t.result?.source === "llm" && t.result.ok)
      .slice(-4)
      .map((t) => ({ q: t.q, a: t.result!.answer }));

    setQ("");
    setLoading(true);
    setTurns((t) => [...t, { id, q: text, result: null }]);
    try {
      const res = await answerQuestionAI(text, table, profiles, domain, history);
      setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, result: res } : t)));
    } finally {
      setLoading(false);
    }
  }

  const lastId = turns[turns.length - 1]?.id;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Ask your data</h3>
        {ai && (
          <span className="rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
            ✨ AI analyst
          </span>
        )}
        {turns.length > 0 && (
          <button
            onClick={() => setTurns([])}
            disabled={loading}
            className="ml-auto rounded-full px-2 py-0.5 text-[11px] text-slate-500 transition hover:text-slate-300 disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {ai
          ? "Plain-English questions, answered like a professional analyst — grounded in your real numbers. Your raw data never leaves this page."
          : "Plain-English questions, answered with your real numbers. Runs locally — no AI key needed."}
      </p>

      {/* Conversation thread */}
      {turns.length > 0 && (
        <div className="mt-4 space-y-4">
          {turns.map((t) => (
            <div key={t.id} className="fade-up space-y-2">
              {/* Question bubble (right-aligned, like a chat) */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-700/50 px-3.5 py-2 text-sm text-slate-100">
                  {t.q}
                </div>
              </div>

              {/* Answer */}
              {t.result ? (
                <div aria-live="polite">
                  <div
                    className={`rounded-2xl rounded-bl-sm border px-4 py-3 text-sm leading-relaxed ${
                      t.result.ok
                        ? "border-blue-500/30 bg-blue-500/10 text-slate-100"
                        : "border-slate-700 bg-slate-800/40 text-slate-300"
                    }`}
                  >
                    <div className="whitespace-pre-line">
                      {t.result.ok ? "💡 " : "🤔 "}
                      {t.result.answer}
                    </div>
                    {t.result.source === "llm" && (
                      <p className="mt-2 text-[10px] uppercase tracking-wide text-blue-300/70">
                        ✨ AI-written · numbers computed locally from your data
                      </p>
                    )}
                  </div>

                  {t.result.chart && (
                    <div className="mt-3">
                      <Chart spec={t.result.chart} />
                    </div>
                  )}

                  {/* Follow-ups only under the most recent answer, to keep the thread tidy. */}
                  {t.id === lastId && t.result.followups && t.result.followups.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Ask next</p>
                      <div className="flex flex-wrap gap-2">
                        {t.result.followups.map((f, i) => (
                          <button
                            key={f}
                            onClick={() => ask(f)}
                            disabled={loading}
                            style={{ animationDelay: `${i * 60}ms` }}
                            className="chip-in rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:-translate-y-0.5 hover:border-blue-500/50 hover:text-blue-300 disabled:opacity-50"
                          >
                            {f} →
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Thinking state
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-blue-300/80">
                  <span className="think-dot" />
                  <span className="think-dot" />
                  <span className="think-dot" />
                  <span className="ml-1 text-xs text-slate-400">Analyzing your data…</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(q)}
          placeholder={turns.length ? "Ask a follow-up…" : suggestions[0] ?? "e.g. total revenue by region"}
          aria-label="Ask a question about your data"
          disabled={loading}
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none disabled:opacity-60"
        />
        <button
          onClick={() => ask(q)}
          disabled={loading || !q.trim()}
          className="btn-shine inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
              Analyzing…
            </>
          ) : (
            "Ask"
          )}
        </button>
      </div>

      {/* Suggestions only before the first question. */}
      {turns.length === 0 && suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={loading}
              style={{ animationDelay: `${i * 60}ms` }}
              className="chip-in rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:-translate-y-0.5 hover:border-blue-500/50 hover:text-blue-300 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
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
