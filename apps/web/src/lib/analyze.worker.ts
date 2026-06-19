/// <reference lib="webworker" />
import type { DashboardSpec, SemanticType, Table } from "./types";
import type { LlmConfig } from "./llm-settings";
import { analyze } from "./analyze";
import { cleanTable } from "./clean";
import { profileTable } from "./profile";
import { detectCurrency, type Currency } from "./currency";

// Runs the full analysis pipeline (clean → profile → stats → charts → insights) OFF the main thread,
// so even a 200k-row file never freezes the UI. The page posts the parsed Table in; we post real
// per-stage progress out, then the finished spec. The optional LLM step does a same-origin
// fetch("/api/insights"), which works from a worker.
//
// As soon as the table is cleaned + profiled (the minimum the Python backend needs), we post a
// "prepared" message carrying the cleaned table + detected currency, so the page can start the deep
// (Python) analysis IN PARALLEL with the rest of the TS dashboard build instead of waiting for it.
// The cleaned table is structured-cloned here (once) and reused by the page, so "done" omits it.

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
  | { type: "prepared"; table: Table; currency: Currency }
  | { type: "done"; spec: DashboardSpec }
  | { type: "error"; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  const { table, userContext, typeOverrides, llm } = e.data;
  const post = (m: AnalyzeMessage) => ctx.postMessage(m);
  try {
    post({ type: "progress", stage: "Cleaning & normalizing" });
    const cleaned = cleanTable(table, typeOverrides);
    // Carry the "this was a sample of a huge file" note through cleaning.
    if (table.sampledFrom) cleaned.table.sampledFrom = table.sampledFrom;

    // Profile + detect currency now, then hand the cleaned table to the page so the deep Python
    // analysis can begin in parallel. These same profiles/currency are reused by analyze() below.
    post({ type: "progress", stage: "Profiling columns" });
    const profiles = profileTable(cleaned.table, cleaned.typeHints);
    const currency = detectCurrency(table, profiles);
    post({ type: "prepared", table: cleaned.table, currency });

    const spec = await analyze(table, {
      userContext,
      cleaned,
      profiles,
      currency,
      llm,
      onStage: (stage) => post({ type: "progress", stage }),
      // Charts carry function formatters that can't be cloned back to the main thread; the client
      // rebuilds them there. Everything else in the spec is plain, cloneable data.
      skipCharts: true,
    });
    post({ type: "done", spec });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : "Analysis failed." });
  }
};
