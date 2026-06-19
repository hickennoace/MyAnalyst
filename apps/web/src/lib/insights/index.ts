import type { InsightProvider } from "../types";
import type { LlmConfig } from "../llm-settings";
import { TemplatedInsightProvider } from "./templated";
import { LlmInsightProvider } from "./llm";

// Factory for the active insight provider.
//
// Set NEXT_PUBLIC_LLM_ENABLED=1 to route insights through the server-side /api/insights LLM endpoint
// (configure the provider + key there via LLM_PROVIDER / LLM_API_KEY / LLM_MODEL). The LLM provider
// gracefully falls back to the templated narrator on any failure, so enabling it can never break the
// dashboard. Left unset, the local templated narrator runs with zero network calls and zero cost.
//
// The privacy boundary - only the metadata-only InsightContext crosses the wire - is enforced by the
// InsightProvider interface and the /api/insights route, regardless of which provider is active.

export function getInsightProvider(byok?: LlmConfig): InsightProvider {
  // A user's own key (BYOK) switches the LLM narrator on regardless of the server flag; otherwise the
  // env flag governs the server-key path. No key anywhere → the local templated narrator.
  const envEnabled = typeof process !== "undefined" && process.env.NEXT_PUBLIC_LLM_ENABLED === "1";
  if (byok) return new LlmInsightProvider(byok);
  return envEnabled ? new LlmInsightProvider() : new TemplatedInsightProvider();
}
