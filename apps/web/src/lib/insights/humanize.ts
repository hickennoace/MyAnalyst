import type { DataStory } from "../types";
import type { LlmConfig } from "../llm-settings";

// LLM helpers for the optional narrator (server key or the caller's bring-your-own key). Everything
// degrades gracefully: on any failure (no key, network error, non-browser) the local result is kept.

// Sharpen the heuristic "what is this data" story via the LLM (metadata only - column
// names/roles, domain, row count; never raw rows). Falls back to the draft on any failure.
export async function sharpenStory(
  draft: DataStory,
  meta: { datasetName: string; domain: string; rowCount: number; columns: { name: string; role: string; type: string }[]; userContext?: string },
  byok?: LlmConfig
): Promise<DataStory> {
  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: "story", draft, meta, byok }),
    });
    if (res.ok) {
      const data = (await res.json()) as { story?: { industry?: string; summary?: string } };
      if (data.story && typeof data.story.summary === "string" && data.story.summary.trim()) {
        return {
          industry: (data.story.industry || draft.industry).trim().slice(0, 60),
          summary: data.story.summary.trim(),
          source: "llm",
        };
      }
    }
  } catch {
    // fall through to the heuristic draft
  }
  return draft;
}

/** Whether the LLM path is switched on - a user's own key (BYOK) counts, as does the server env flag. */
export function llmEnabled(byok?: LlmConfig): boolean {
  if (byok) return true;
  return typeof process !== "undefined" && process.env.NEXT_PUBLIC_LLM_ENABLED === "1";
}
