"use client";

import { useEffect, useState } from "react";
import { LLM_PROVIDERS, loadLlmSettings, saveLlmSettings, type LlmProvider, type LlmSettings } from "@/lib/llm-settings";
import { webgpuAvailable } from "@/lib/local-llm";
import { Portal } from "./Portal";

// AI narration settings. Two zero-cost-to-us options, both off by default:
//  • Bring-your-own-key - your provider key, stored on this device, sent only with the analysis request
//    (metadata-only context, never raw rows).
//  • On-device model - transformers.js + WebGPU; narration runs fully in your browser with no network.

export function AiKeyEditor({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<LlmSettings>({ enabled: false, provider: "groq", apiKey: "", model: "", localModel: false });
  const [gpu, setGpu] = useState(true);

  useEffect(() => {
    setS(loadLlmSettings());
    setGpu(webgpuAvailable());
  }, []);

  const update = (patch: Partial<LlmSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveLlmSettings(next);
  };

  const placeholder = LLM_PROVIDERS.find((p) => p.id === s.provider)?.placeholder ?? "";

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">AI narration (your key)</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">✕</button>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Optional. Use your own LLM key to sharpen the data story and insights. Stored on this device only and sent solely with the
          analysis request - the context stays metadata-only (never your raw rows).
        </p>

        {/* On-device option - the strongest privacy story; no key needed. */}
        <label className="mt-4 flex items-center justify-between text-xs text-slate-300">
          <span>Run on-device (WebGPU) <span className="text-slate-500">- no network</span></span>
          <input
            type="checkbox"
            checked={!!s.localModel}
            disabled={!gpu}
            onChange={(e) => update({ localModel: e.target.checked })}
            className="h-4 w-4 accent-[#ff5740]"
          />
        </label>
        {s.localModel && (
          <p className="mt-1 text-[10px] text-slate-500">A small model (~0.5B) downloads once on first use, then runs fully in your browser. Takes a moment to warm up.</p>
        )}
        {!gpu && <p className="mt-1 text-[10px] text-amber-400/80">This browser doesn’t expose WebGPU - on-device mode is unavailable here.</p>}

        <div className="my-3 border-t border-slate-800" />

        <label className="flex items-center justify-between text-xs text-slate-300">
          <span>Use my provider key instead</span>
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[#ff5740]"
          />
        </label>

        <label className="mt-3 block text-xs text-slate-300">
          Provider
          <select
            value={s.provider}
            onChange={(e) => update({ provider: e.target.value as LlmProvider })}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none focus:border-[#ff5740]"
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
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-slate-100 outline-none focus:border-[#ff5740]"
          />
        </label>

        <label className="mt-3 block text-xs text-slate-300">
          Model <span className="text-slate-500">(optional)</span>
          <input
            value={s.model ?? ""}
            onChange={(e) => update({ model: e.target.value })}
            placeholder={placeholder}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-slate-100 outline-none focus:border-[#ff5740]"
          />
        </label>

        <div className="mt-5 flex justify-between">
          <button onClick={() => update({ enabled: false, apiKey: "" })} className="text-xs text-slate-500 hover:text-slate-300">Clear key</button>
          <button onClick={onClose} className="rounded-lg bg-[#ff5740] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#ff3b30]">Done</button>
        </div>
        <p className="mt-3 text-[10px] text-slate-600">Re-run the analysis after changing this for it to take effect.</p>
      </div>
    </div>
    </Portal>
  );
}
