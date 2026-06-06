"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DashboardSpec } from "@/lib/types";
import { decodeSpec } from "@/lib/share";
import { DashboardView } from "@/components/DashboardView";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LangToggle } from "@/components/LangToggle";
import { exportPdf, exportPng } from "@/lib/export";

// Read-only shared dashboard. Reconstructs a DashboardSpec from the URL hash fragment (never sent to
// any server) and renders it. No uploader, no chart builder — view + export only.

export default function ViewPage() {
  const [spec, setSpec] = useState<DashboardSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<null | "png" | "pdf">(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const payload = window.location.hash.replace(/^#/, "");
    if (!payload) {
      setError("This link doesn't contain a dashboard.");
      return;
    }
    decodeSpec(payload)
      .then(setSpec)
      .catch(() => setError("This link is invalid or was created by a newer version."));
  }, []);

  async function handleExport(kind: "png" | "pdf") {
    if (!dashboardRef.current || !spec || exporting) return;
    setExporting(kind);
    try {
      if (kind === "png") await exportPng(dashboardRef.current, spec.datasetName);
      else await exportPdf(dashboardRef.current, spec.datasetName);
    } catch {
      /* ignore — export is best-effort */
    } finally {
      setExporting(null);
    }
  }

  return (
    <main id="main-content" className="glow app-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="brand-mark animate grid h-10 w-10 place-items-center rounded-xl text-lg font-black text-white">
              Q
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-50">Quantia</h1>
              <p className="text-xs text-slate-400">Shared dashboard · read-only</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
            {spec && (
              <>
                <button
                  onClick={() => handleExport("png")}
                  disabled={!!exporting}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-50"
                >
                  {exporting === "png" ? "Exporting…" : "⬇ PNG"}
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-50"
                >
                  {exporting === "pdf" ? "Exporting…" : "⬇ PDF"}
                </button>
              </>
            )}
            <Link
              href="/analyze"
              className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-400"
            >
              Analyze your own →
            </Link>
          </div>
        </header>

        {error && (
          <div className="card p-8 text-center">
            <p className="text-sm text-rose-300">{error}</p>
            <Link href="/analyze" className="mt-4 inline-block text-sm text-blue-300 hover:text-blue-200">
              → Create your own dashboard
            </Link>
          </div>
        )}

        {!spec && !error && (
          <div className="card flex items-center gap-3 p-4">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
            <span className="text-sm text-slate-300">Loading shared dashboard…</span>
          </div>
        )}

        {spec && (
          <>
            <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/30 px-4 py-2.5 text-xs text-slate-400">
              👁️ You're viewing a read-only shared dashboard. It was reconstructed entirely in your browser —
              no data was sent to any server.
            </div>
            <DashboardView spec={spec} innerRef={dashboardRef} />
          </>
        )}

        <footer className="mt-16 border-t border-slate-800 pt-6 text-center text-xs text-slate-600">
          Quantia · Shared dashboards are encoded in the link itself — nothing is stored on a server.
        </footer>
      </div>
    </main>
  );
}
