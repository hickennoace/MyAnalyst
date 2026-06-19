"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DashboardSpec } from "@/lib/types";
import type { PyConclusions } from "@/lib/py-engine";
import { decodeShare } from "@/lib/share";
import { DashboardView } from "@/components/DashboardView";
import { PresenterMode } from "@/components/PresenterMode";
import { DISCLAIMER_TEXT } from "@/components/Disclaimer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrandMark } from "@/components/BrandMark";
import { exportPdf, exportPng } from "@/lib/export";

// Read-only shared dashboard. Reconstructs a DashboardSpec from the URL hash fragment (never sent to
// any server) and renders it. No uploader, no chart builder — view + export only.

export default function ViewPage() {
  const [spec, setSpec] = useState<DashboardSpec | null>(null);
  const [conclusions, setConclusions] = useState<PyConclusions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<null | "png" | "pdf">(null);
  const [presenting, setPresenting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const payload = window.location.hash.replace(/^#/, "");
    if (!payload) {
      setError("This link doesn't contain a dashboard.");
      return;
    }
    decodeShare(payload)
      .then(({ spec, conclusions }) => {
        setSpec(spec);
        setConclusions(conclusions);
      })
      .catch(() => setError("This link is invalid or was created by a newer version."));
  }, []);

  async function handleExport(kind: "png" | "pdf") {
    if (!dashboardRef.current || !spec || exporting) return;
    setExporting(kind);
    try {
      const meta = `${spec.rowCount.toLocaleString()} rows · ${spec.profiles.length} columns · ${spec.domain.domain}`;
      if (kind === "png") await exportPng(dashboardRef.current, spec.datasetName, meta);
      else await exportPdf(dashboardRef.current, spec.datasetName, meta);
    } catch {
      /* ignore — export is best-effort */
    } finally {
      setExporting(null);
    }
  }

  return (
    <main id="main-content" className="glow app-bg min-h-screen">
      <div className="app-aurora" aria-hidden>
        <span className="a1" /><span className="a2" /><span className="a3" />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-50">MyAnalyst</h1>
              <p className="text-xs text-slate-400">Shared dashboard · read-only</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {spec && (
              <>
                <button
                  onClick={() => setPresenting(true)}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60"
                  title="Full-screen presenter mode"
                >
                  ▶ Present
                </button>
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
              className="rounded-xl bg-[#ff5740] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#ff3b30]"
            >
              Analyze your own →
            </Link>
          </div>
        </header>

        {error && (
          <div className="card p-8 text-center">
            <p className="text-sm text-rose-300">{error}</p>
            <Link href="/analyze" className="mt-4 inline-block text-sm text-[#ff5740] hover:text-[#ff5740]">
              → Create your own dashboard
            </Link>
          </div>
        )}

        {!spec && !error && (
          <div className="card flex items-center gap-3 p-4">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#ff5740] border-t-transparent" />
            <span className="text-sm text-slate-300">Loading shared dashboard…</span>
          </div>
        )}

        {spec && (
          <>
            <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/30 px-4 py-2.5 text-xs text-slate-400">
              👁️ You're viewing a read-only shared dashboard. It was reconstructed entirely in your browser —
              no data was sent to any server.
            </div>
            <ErrorBoundary label="dashboard">
              <DashboardView spec={spec} conclusions={conclusions} innerRef={dashboardRef} />
            </ErrorBoundary>
          </>
        )}

        {presenting && spec && <PresenterMode spec={spec} conclusions={conclusions} onClose={() => setPresenting(false)} />}

        <footer className="mt-16 space-y-2 border-t border-slate-800 pt-6 text-center text-xs text-slate-600">
          <p>MyAnalyst · Shared dashboards are encoded in the link itself — nothing is stored on a server.</p>
          <p className="text-slate-500">{DISCLAIMER_TEXT}</p>
        </footer>
      </div>
    </main>
  );
}
