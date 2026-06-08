// On-device LLM narration via transformers.js + WebGPU. The strongest privacy posture available: the
// model runs entirely in the browser, so narration happens with ZERO network calls at inference time
// (the model weights download once on first use, then the browser caches them). Opt-in and lazy — the
// heavy library + weights only load when the user turns it on. Everything degrades gracefully: any
// failure (no WebGPU, download blocked, OOM) returns null and the caller keeps the local templated text.

const MODEL = "onnx-community/Qwen2.5-0.5B-Instruct"; // small instruct model with ONNX weights for the web

export interface LocalModelProgress {
  status: string;
  /** 0..1 overall download progress when known. */
  progress?: number;
  file?: string;
}

export function webgpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

// Cache the generator pipeline across calls so the model is loaded once per session.
let pipePromise: Promise<unknown> | null = null;

async function getGenerator(onProgress?: (p: LocalModelProgress) => void): Promise<((messages: unknown, opts: unknown) => Promise<unknown>) | null> {
  if (!webgpuAvailable()) return null;
  if (!pipePromise) {
    pipePromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      return pipeline("text-generation", MODEL, {
        device: "webgpu",
        dtype: "q4f16",
        progress_callback: (p: LocalModelProgress) => onProgress?.(p),
      });
    })().catch((e) => {
      pipePromise = null; // allow a retry after a transient failure
      throw e;
    });
  }
  return pipePromise as Promise<((messages: unknown, opts: unknown) => Promise<unknown>) | null>;
}

/** Pre-warm the model (so a later narration is instant). Returns true if the pipeline loaded. */
export async function warmLocalModel(onProgress?: (p: LocalModelProgress) => void): Promise<boolean> {
  try {
    return (await getGenerator(onProgress)) !== null;
  } catch {
    return false;
  }
}

interface StoryMeta {
  datasetName: string;
  domain: string;
  rowCount: number;
  columns: { name: string; role: string; type: string }[];
  userContext?: string;
}

/** Narrate the "what is this data" story locally. Returns null on any failure (caller keeps its draft). */
export async function localNarrateStory(meta: StoryMeta, draft: string, onProgress?: (p: LocalModelProgress) => void): Promise<string | null> {
  try {
    const gen = await getGenerator(onProgress);
    if (!gen) return null;
    const cols = meta.columns.slice(0, 25).map((c) => `${c.name} (${c.type}/${c.role})`).join(", ");
    const messages = [
      { role: "system", content: "You are a precise data analyst. In 2–3 sentences, explain what a dataset is about and what it's used for. Use only the metadata given — never invent specific numbers. Plain, professional language." },
      { role: "user", content: `Dataset: ${meta.datasetName}\nDomain: ${meta.domain}\nRows: ${meta.rowCount}\nColumns: ${cols}${meta.userContext ? `\nUser context: ${meta.userContext}` : ""}\n\nDraft to improve: ${draft}\n\nWrite the 2–3 sentence summary.` },
    ];
    const out = (await gen(messages, { max_new_tokens: 160, temperature: 0.4, do_sample: true, return_full_text: false })) as unknown;
    return extractText(out);
  } catch {
    return null;
  }
}

/** Pull the assistant's text out of transformers.js text-generation output (chat or plain shapes). */
function extractText(out: unknown): string | null {
  const first = Array.isArray(out) ? (out[0] as { generated_text?: unknown }) : (out as { generated_text?: unknown });
  const gt = first?.generated_text;
  if (typeof gt === "string") return gt.trim() || null;
  if (Array.isArray(gt)) {
    // chat shape: array of {role, content}; take the last assistant message.
    for (let i = gt.length - 1; i >= 0; i--) {
      const m = gt[i] as { role?: string; content?: string };
      if (m?.role === "assistant" && m.content) return m.content.trim() || null;
    }
    const last = gt[gt.length - 1] as { content?: string };
    return last?.content?.trim() || null;
  }
  return null;
}
