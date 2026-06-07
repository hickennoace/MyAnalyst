"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  partial?: string; // streamed prose so far, shown live before `result` lands
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
  const threadEndRef = useRef<HTMLDivElement>(null);
  const ai = useMemo(() => llmEnabled(), []);

  const suggestions = useMemo(() => buildSuggestions(profiles), [profiles]);

  // Keep the newest question/answer in view as the conversation grows. Skip the very first
  // render (nothing to scroll to) and honor reduced-motion preferences.
  useEffect(() => {
    if (turns.length === 0) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    threadEndRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, [turns, loading]);

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
      // Stream tokens into the turn's `partial` so the answer types out live.
      const res = await answerQuestionAI(text, table, profiles, domain, history, (delta) => {
        setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, partial: (t.partial ?? "") + delta } : t)));
      });
      setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, result: res, partial: undefined } : t)));
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
                    {/* Show the math: an auditable account of exactly how the number was computed. */}
                    {t.result.method && (
                      <details className="group mt-2">
                        <summary className="flex cursor-pointer select-none items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 transition hover:text-slate-200 [&::-webkit-details-marker]:hidden">
                          <span className="inline-block transition group-open:rotate-90">▸</span> How I computed this
                        </summary>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{t.result.method}</p>
                      </details>
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
              ) : t.partial ? (
                // Streaming: the answer types out live as tokens arrive.
                <div aria-live="polite">
                  <div className="rounded-2xl rounded-bl-sm border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm leading-relaxed text-slate-100">
                    <div className="whitespace-pre-line">
                      💡 {t.partial}
                      <span className="type-caret">▋</span>
                    </div>
                  </div>
                </div>
              ) : (
                // Thinking state (before the first token arrives)
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-blue-300/80">
                  <span className="think-dot" />
                  <span className="think-dot" />
                  <span className="think-dot" />
                  <span className="ml-1 text-xs text-slate-400">Analyzing your data…</span>
                </div>
              )}
            </div>
          ))}
          <div ref={threadEndRef} aria-hidden />
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
  // A filtered example, so the "ask about a slice" capability is discoverable. Use a real top value.
  const topVal = dims[0]?.topValues?.[0]?.value;
  if (metrics[0] && dims[0] && topVal) out.push(`total ${metrics[0].name} for ${topVal}`);
  else if (dims[0] && metrics[0]) out.push(`which ${dims[0].name} has the highest ${metrics[0].name}`);
  if (metrics.length >= 2) out.push(`correlation between ${metrics[0].name} and ${metrics[1].name}`);
  if (time && metrics[0]) out.push(`how did ${metrics[0].name} change over time`);
  return out.slice(0, 5);
}
