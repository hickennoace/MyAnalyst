// Bring-your-own-key LLM settings. Stored locally only (never synced, never logged). When set, the
// analyzer routes the optional narrator/query-planner through the user's own provider key for
// higher-reliability output — at zero cost to us and with no change to the privacy boundary (only the
// metadata-only context is ever sent, exactly as with the server key).

export type LlmProvider = "groq" | "openai" | "anthropic" | "gemini" | "openrouter";

/** The minimal config sent to /api/insights as `byok` for a single request. */
export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model?: string;
}

/** Persisted shape, including the on/off toggle. */
export interface LlmSettings extends LlmConfig {
  enabled: boolean;
}

const KEY = "quantia:llm";

export const LLM_PROVIDERS: { id: LlmProvider; label: string; placeholder: string }[] = [
  { id: "groq", label: "Groq", placeholder: "llama-3.3-70b-versatile" },
  { id: "openai", label: "OpenAI", placeholder: "gpt-4o-mini" },
  { id: "anthropic", label: "Anthropic", placeholder: "claude-haiku-4-5" },
  { id: "gemini", label: "Google Gemini", placeholder: "gemini-2.5-flash" },
  { id: "openrouter", label: "OpenRouter", placeholder: "meta-llama/llama-3.3-70b-instruct" },
];

export function loadLlmSettings(): LlmSettings {
  const fallback: LlmSettings = { enabled: false, provider: "groq", apiKey: "", model: "" };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<LlmSettings>;
    const provider = LLM_PROVIDERS.some((x) => x.id === p.provider) ? (p.provider as LlmProvider) : "groq";
    return {
      enabled: !!p.enabled,
      provider,
      apiKey: typeof p.apiKey === "string" ? p.apiKey : "",
      model: typeof p.model === "string" ? p.model : "",
    };
  } catch {
    return fallback;
  }
}

export function saveLlmSettings(s: LlmSettings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* non-fatal */
  }
}

/** The BYOK config to send with a request, or null when not enabled / no key. */
export function activeLlmConfig(): LlmConfig | null {
  const s = loadLlmSettings();
  if (!s.enabled || !s.apiKey.trim()) return null;
  return { provider: s.provider, apiKey: s.apiKey.trim(), model: s.model?.trim() || undefined };
}
