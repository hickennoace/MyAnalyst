"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_BRAND, loadBrand, saveBrand, type BrandSettings } from "@/lib/brand";
import { Portal } from "./Portal";

// Small white-label editor: company name, accent colour, and an optional logo for exported
// deliverables (report PDF / slide deck / image header). Persists to localStorage only.

export function BrandEditor({ onClose }: { onClose: () => void }) {
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRAND);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setBrand(loadBrand()), []);

  const update = (patch: Partial<BrandSettings>) => {
    const next = { ...brand, ...patch };
    setBrand(next);
    saveBrand(next);
  };

  const onLogo = (file: File) => {
    if (!/image\/(png|jpe?g)/.test(file.type)) return;
    if (file.size > 512 * 1024) return; // keep embeds small
    const reader = new FileReader();
    reader.onload = () => update({ logoDataUrl: typeof reader.result === "string" ? reader.result : undefined });
    reader.readAsDataURL(file);
  };

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Brand your reports</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">✕</button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Applied to PDF report, slide deck, and image exports. Stored on this device only.</p>

        <label className="mt-4 block text-xs text-slate-300">
          Name
          <input
            value={brand.name}
            onChange={(e) => update({ name: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none focus:border-[#ff5740]"
          />
        </label>

        <label className="mt-3 flex items-center justify-between text-xs text-slate-300">
          Accent colour
          <input type="color" value={brand.accent} onChange={(e) => update({ accent: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-slate-700 bg-transparent" />
        </label>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
          <span>Logo (PNG/JPEG, ≤512KB)</span>
          <div className="flex items-center gap-2">
            {brand.logoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoDataUrl} alt="logo preview" className="h-7 w-7 rounded object-contain" />
            )}
            <button onClick={() => fileRef.current?.click()} className="rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800">Upload</button>
            {brand.logoDataUrl && (
              <button onClick={() => update({ logoDataUrl: undefined })} className="rounded-md px-2 py-1 text-slate-500 hover:text-slate-300">Remove</button>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogo(f); e.target.value = ""; }} />

        <div className="mt-5 flex justify-between">
          <button onClick={() => { saveBrand(DEFAULT_BRAND); setBrand(DEFAULT_BRAND); }} className="text-xs text-slate-500 hover:text-slate-300">Reset</button>
          <button onClick={onClose} className="rounded-lg bg-[#ff5740] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#ff3b30]">Done</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
