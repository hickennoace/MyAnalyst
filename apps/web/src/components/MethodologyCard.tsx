"use client";

import type { DashboardSpec } from "@/lib/types";
import { buildMethodology, buildRecipe, fingerprint } from "@/lib/methodology";

// "How this was computed" appendix: assumptions, the statistical methods used, and the limitations -
// the transparency a consultant deliverable carries. Stays in the PNG/PDF export. Also offers a
// downloadable recipe (settings + a deterministic fingerprint) so the analysis is reproducible.

export function MethodologyCard({ spec }: { spec: DashboardSpec }) {
  const sections = buildMethodology(spec);
  const fp = fingerprint(spec);

  const downloadRecipe = () => {
    const blob = new Blob([JSON.stringify(buildRecipe(spec), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(spec.datasetName.replace(/\.[^.]+$/, "") || "analysis").replace(/[^a-z0-9-_]+/gi, "_")}.recipe.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card p-5">
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        {sections.map((s) => (
          <div key={s.heading}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.heading}</h4>
            <ul className="mt-2 space-y-1.5">
              {s.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-slate-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
        <p className="text-[11px] text-slate-500">
          Reproducible - same file + settings ⇒ same result. Fingerprint <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-300">{fp}</code>
        </p>
        <button
          type="button"
          onClick={downloadRecipe}
          className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800"
        >
          Download recipe (.json)
        </button>
      </div>
    </div>
  );
}
