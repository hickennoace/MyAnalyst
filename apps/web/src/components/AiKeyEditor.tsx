"use client";

import { useEffect, useState } from "react";
import { LLM_PROVIDERS, loadLlmSettings, saveLlmSettings, type LlmProvider, type LlmSettings } from "@/lib/llm-settings";

// Bring-your-own-key editor. The key is stored only on this device and sent solely with the analysis
// request to sharpen the narration; the data context remains metadata-only. Off by default.

export function AiKeyEditor({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<LlmSettings>({ enabled: false, provider: "groq", apiKey: "", model: "" });

  useEffect(() => setS(loadLlmSettings()), []);

  const update = (patch: Partial<LlmSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveLlmSettings(next);
  };

  const placeholder = LLM_PROVIDERS.find((p) => p.id === s.provider)?.placeholder ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">AI narration (your key)</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">✕</button>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Optional. Use your own LLM key to sharpen the data story and insights. Stored on this device only and sent solely with the
          analysis request — the context stays metadata-only (never your raw rows).
        </p>

        <label className="mt-4 flex items-center justify-between text-xs text-slate-300">
          <span>Enable AI narration</span>
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="h-4 w-4 accent-blue-500"
          />
        </label>

        <label className="mt-3 block text-xs text-slate-300">
          Provider
          <select
            value={s.provider}
            onChange={(e) => update({ provider: e.target.value as LlmProvider })}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none focus:border-blue-500"
          >
            {LLM_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>

        <label className="mt-3 block text-xs text-slate-300">
          API key
          <input
            type="password"
            value={s.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
            placeholder="sk-…"
            autoComplete="off"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-slate-100 outline-none focus:border-blue-500"
          />
        </label>

        <label className="mt-3 block text-xs text-slate-300">
          Model <span className="text-slate-500">(optional)</span>
          <input
            value={s.model ?? ""}
            onChange={(e) => update({ model: e.target.value })}
            placeholder={placeholder}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-slate-100 outline-none focus:border-blue-500"
          />
        </label>

        <div className="mt-5 flex justify-between">
          <button onClick={() => update({ enabled: false, apiKey: "" })} className="text-xs text-slate-500 hover:text-slate-300">Clear key</button>
          <button onClick={onClose} className="rounded-lg bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-400">Done</button>
        </div>
        <p className="mt-3 text-[10px] text-slate-600">Re-run the analysis after changing this for it to take effect.</p>
      </div>
    </div>
  );
}
