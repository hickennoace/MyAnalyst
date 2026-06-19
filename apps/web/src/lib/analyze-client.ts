import type { DashboardSpec, SemanticType, Table } from "./types";
import type { AnalyzeMessage } from "./analyze.worker";
import type { Currency } from "./currency";
import type { LlmConfig } from "./llm-settings";

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
  typeOverrides?: Record<string, SemanticType>,
  llm?: LlmConfig,
  /** Fired the moment the table is cleaned + profiled, with the cleaned table and detected currency,
   *  so callers can start the deep (Python) analysis in parallel with the rest of the TS build. */
  onPrepared?: (cleaned: Table, currency: Currency) => void
): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./analyze.worker.ts", import.meta.url), { type: "module" });
    } catch {
      runOnMainThread(table, userContext, onStage, typeOverrides, llm, onPrepared).then(resolve, reject);
      return;
    }

    let settled = false;
    // The cleaned table arrives on the "prepared" message (cloned once) and is reused for the final
    // result, so "done" doesn't re-send it.
    let preparedTable: Table | null = null;
    const cleanup = () => {
      worker.terminate();
    };

    worker.onmessage = async (e: MessageEvent<AnalyzeMessage>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        onStage?.(msg.stage);
      } else if (msg.type === "prepared") {
        preparedTable = msg.table;
        onPrepared?.(msg.table, msg.currency);
      } else if (msg.type === "done") {
        settled = true;
        cleanup();
        try {
          const cleaned = preparedTable;
          if (!cleaned) throw new Error("Analysis finished without a prepared table.");
          // The worker detected the currency; mirror it onto the main thread so charts (built here) and
          // later ask-your-data format money in the same currency the dashboard shows.
          const [{ recommendCharts }, { setActiveCurrency }] = await Promise.all([
            import("./charts"),
            import("./currency"),
          ]);
          setActiveCurrency(msg.spec.currency);
          msg.spec.charts = recommendCharts(cleaned, msg.spec.profiles);
          resolve({ spec: msg.spec, table: cleaned });
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Failed to build charts."));
        }
      } else if (msg.type === "error") {
        settled = true;
        cleanup();
        reject(new Error(msg.message));
      }
    };

    worker.onerror = (e) => {
      if (settled) return;
      // The worker failed to even start/run - fall back to the main thread so analysis still works.
      cleanup();
      runOnMainThread(table, userContext, onStage, typeOverrides, llm, onPrepared).then(resolve, reject);
      e.preventDefault?.();
    };

    worker.postMessage({ table, userContext, typeOverrides, llm });
  });
}

async function runOnMainThread(
  table: Table,
  userContext: string | undefined,
  onStage?: (stage: string) => void,
  typeOverrides?: Record<string, SemanticType>,
  llm?: LlmConfig,
  onPrepared?: (cleaned: Table, currency: Currency) => void
): Promise<AnalysisResult> {
  const [{ analyze }, { cleanTable }, { profileTable }, { detectCurrency }] = await Promise.all([
    import("./analyze"),
    import("./clean"),
    import("./profile"),
    import("./currency"),
  ]);
  onStage?.("Cleaning & normalizing");
  const cleaned = cleanTable(table, typeOverrides);
  if (table.sampledFrom) cleaned.table.sampledFrom = table.sampledFrom;
  onStage?.("Profiling columns");
  const profiles = profileTable(cleaned.table, cleaned.typeHints);
  const currency = detectCurrency(table, profiles);
  onPrepared?.(cleaned.table, currency);
  const spec = await analyze(table, { userContext, cleaned, profiles, currency, llm, onStage });
  return { spec, table: cleaned.table };
}
