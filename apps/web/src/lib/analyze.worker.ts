/// <reference lib="webworker" />
import type { DashboardSpec, SemanticType, Table } from "./types";
import type { LlmConfig } from "./llm-settings";
import { analyze } from "./analyze";
import { cleanTable } from "./clean";

// Runs the full analysis pipeline (clean → profile → stats → charts → insights) OFF the main thread,
// so even a 200k-row file never freezes the UI. The page posts the parsed Table in; we post real
// per-stage progress out, then the finished spec + cleaned table. The optional LLM step does a
// same-origin fetch("/api/insights"), which works from a worker.

export interface AnalyzeRequest {
  table: Table;
  userContext?: string;
  /** User-pinned column types from the column controls (overrides auto-detection). */
  typeOverrides?: Record<string, SemanticType>;
  /** Optional bring-your-own-key LLM config (passed through to the narrator). */
  llm?: LlmConfig;
}

export type AnalyzeMessage =
  | { type: "progress"; stage: string }
  | { type: "done"; spec: DashboardSpec; table: Table }
  | { type: "error"; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  const { table, userContext, typeOverrides, llm } = e.data;
  const post = (m: AnalyzeMessage) => ctx.postMessage(m);
  try {
    post({ type: "progress", stage: "Cleaning & normalizing" });
    const cleaned = cleanTable(table, typeOverrides);
    const spec = await analyze(table, {
      userContext,
      cleaned,
      llm,
      onStage: (stage) => post({ type: "progress", stage }),
      // Charts carry function formatters that can't be cloned back to the main thread; the client
      // rebuilds them there. Everything else in the spec is plain, cloneable data.
      skipCharts: true,
    });
    // Carry the "this was a sample of a huge file" note through cleaning.
    if (table.sampledFrom) cleaned.table.sampledFrom = table.sampledFrom;
    post({ type: "done", spec, table: cleaned.table });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : "Analysis failed." });
  }
};
