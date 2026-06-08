import type { Insight, InsightContext, InsightProvider } from "../types";
import type { LlmConfig } from "../llm-settings";
import { TemplatedInsightProvider } from "./templated";

// LLM-backed narrator. It POSTs the metadata-only InsightContext to the server route (which holds the
// API key, or uses the caller's bring-your-own key) and returns the model's grounded insights. On ANY
// failure — no key, network error, bad response, or running outside the browser (e.g. the smoke test) —
// it falls back to the templated narrator so the dashboard always renders.

export class LlmInsightProvider implements InsightProvider {
  readonly name = "llm";
  lastSource: "llm" | "templated" = "templated";
  private fallback = new TemplatedInsightProvider();

  constructor(private byok?: LlmConfig) {}

  async generate(ctx: InsightContext): Promise<Insight[]> {
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(this.byok ? { ...ctx, byok: this.byok } : ctx),
      });
      if (res.ok) {
        const data = (await res.json()) as { insights?: Insight[] };
        if (Array.isArray(data.insights) && data.insights.length > 0) {
          this.lastSource = "llm";
          return data.insights;
        }
      }
    } catch {
      // swallow — fall through to templated
    }
    this.lastSource = "templated";
    return this.fallback.generate(ctx);
  }
}
