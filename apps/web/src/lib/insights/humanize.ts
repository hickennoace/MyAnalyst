import type { Conclusion, DataStory } from "../types";

// Optionally polish the deterministic conclusions into warmer, more human prose via the LLM endpoint.
// The numbers/meaning are preserved (the server prompt forbids changing them). On ANY failure — no key,
// network error, non-browser — the original conclusions are returned unchanged.

export async function humanizeConclusions(conclusions: Conclusion[], userContext?: string): Promise<Conclusion[]> {
  if (conclusions.length === 0) return conclusions;
  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        task: "humanize",
        userContext,
        conclusions: conclusions.map((c) => ({ id: c.id, text: c.text, detail: c.detail })),
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { conclusions?: { id: string; text: string }[] };
      if (Array.isArray(data.conclusions) && data.conclusions.length > 0) {
        const map = new Map(data.conclusions.map((c) => [c.id, c.text]));
        return conclusions.map((c) => (map.has(c.id) ? { ...c, text: map.get(c.id)! } : c));
      }
    }
  } catch {
    // fall through to originals
  }
  return conclusions;
}

// Sharpen the heuristic "what is this data" story via the LLM (metadata only — column
// names/roles, domain, row count; never raw rows). Falls back to the draft on any failure.
export async function sharpenStory(
  draft: DataStory,
  meta: { datasetName: string; domain: string; rowCount: number; columns: { name: string; role: string; type: string }[]; userContext?: string }
): Promise<DataStory> {
  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: "story", draft, meta }),
    });
    if (res.ok) {
      const data = (await res.json()) as { story?: { industry?: string; summary?: string } };
      if (data.story && typeof data.story.summary === "string" && data.story.summary.trim()) {
        return {
          industry: (data.story.industry || draft.industry).trim().slice(0, 60),
          summary: data.story.summary.trim(),
        };
      }
    }
  } catch {
    // fall through to the heuristic draft
  }
  return draft;
}

/** Whether the LLM path is switched on (public flag; the key itself stays server-side). */
export function llmEnabled(): boolean {
  return typeof process !== "undefined" && process.env.NEXT_PUBLIC_LLM_ENABLED === "1";
}
