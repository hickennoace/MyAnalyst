import type { InsightProvider } from "../types";
import { TemplatedInsightProvider } from "./templated";

// Factory for the active insight provider. Today it returns the local templated narrator.
// To go LLM-backed later: add an `LlmInsightProvider` that POSTs the (metadata-only) InsightContext
// to a Next.js route handler holding the API key server-side, and select it here behind an env flag.
// The privacy boundary — only InsightContext ever crosses — is enforced by the interface itself.

export function getInsightProvider(): InsightProvider {
  // e.g. if (process.env.NEXT_PUBLIC_INSIGHT_PROVIDER === "llm") return new LlmInsightProvider();
  return new TemplatedInsightProvider();
}
