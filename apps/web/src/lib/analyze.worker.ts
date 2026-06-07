/// <reference lib="webworker" />
import type { DashboardSpec, Table } from "./types";
import { analyze } from "./analyze";
import { cleanTable } from "./clean";

// Runs the full analysis pipeline (clean → profile → stats → charts → insights) OFF the main thread,
// so even a 200k-row file never freezes the UI. The page posts the parsed Table in; we post real
// per-stage progress out, then the finished spec + cleaned table. The optional LLM step does a
// same-origin fetch("/api/insights"), which works from a worker.

export interface AnalyzeRequest {
  table: Table;
  userContext?: string;
}

export type AnalyzeMessage =
  | { type: "progress"; stage: string }
  | { type: "done"; spec: DashboardSpec; table: Table }
  | { type: "error"; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  const { table, userContext } = e.data;
  const post = (m: AnalyzeMessage) => ctx.postMessage(m);
  try {
    post({ type: "progress", stage: "Cleaning & normalizing" });
    const cleaned = cleanTable(table);
    const spec = await analyze(table, {
      userContext,
      cleaned,
      onStage: (stage) => post({ type: "progress", stage }),
    });
    // Carry the "this was a sample of a huge file" note through cleaning.
    if (table.sampledFrom) cleaned.table.sampledFrom = table.sampledFrom;
    post({ type: "done", spec, table: cleaned.table });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : "Analysis failed." });
  }
};
