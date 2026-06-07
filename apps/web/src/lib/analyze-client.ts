import type { DashboardSpec, SemanticType, Table } from "./types";
import type { AnalyzeMessage } from "./analyze.worker";

// Drives the analysis off the main thread via a Web Worker, reporting real per-stage progress.
// Falls back to running on the main thread if workers aren't available (very old browsers / SSR).

export interface AnalysisResult {
  spec: DashboardSpec;
  table: Table;
}

export function runAnalysis(
  table: Table,
  userContext: string | undefined,
  onStage?: (stage: string) => void,
  typeOverrides?: Record<string, SemanticType>
): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./analyze.worker.ts", import.meta.url), { type: "module" });
    } catch {
      runOnMainThread(table, userContext, onStage, typeOverrides).then(resolve, reject);
      return;
    }

    let settled = false;
    const cleanup = () => {
      worker.terminate();
    };

    worker.onmessage = (e: MessageEvent<AnalyzeMessage>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        onStage?.(msg.stage);
      } else if (msg.type === "done") {
        settled = true;
        cleanup();
        resolve({ spec: msg.spec, table: msg.table });
      } else if (msg.type === "error") {
        settled = true;
        cleanup();
        reject(new Error(msg.message));
      }
    };

    worker.onerror = (e) => {
      if (settled) return;
      // The worker failed to even start/run — fall back to the main thread so analysis still works.
      cleanup();
      runOnMainThread(table, userContext, onStage, typeOverrides).then(resolve, reject);
      e.preventDefault?.();
    };

    worker.postMessage({ table, userContext, typeOverrides });
  });
}

async function runOnMainThread(
  table: Table,
  userContext: string | undefined,
  onStage?: (stage: string) => void,
  typeOverrides?: Record<string, SemanticType>
): Promise<AnalysisResult> {
  const [{ analyze }, { cleanTable }] = await Promise.all([import("./analyze"), import("./clean")]);
  onStage?.("Cleaning & normalizing");
  const cleaned = cleanTable(table, typeOverrides);
  const spec = await analyze(table, { userContext, cleaned, onStage });
  if (table.sampledFrom) cleaned.table.sampledFrom = table.sampledFrom;
  return { spec, table: cleaned.table };
}
