"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  deleteSavedAnalysis,
  getJobDescription,
  listSavedAnalyses,
  loadSavedAnalysis,
  saveJobDescription,
  type SavedAnalysisMeta,
} from "@/lib/account";
import { encodeSpec } from "@/lib/share";
import { downloadCsv } from "@/lib/csv";
import { UserMenu } from "@/components/auth/UserMenu";
import { AuthModal } from "@/components/auth/AuthModal";

export default function AccountPage() {
  const { enabled, user, loading } = useAuth();
  const [job, setJob] = useState("");
  const [jobMsg, setJobMsg] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<SavedAnalysisMeta[]>([]);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    getJobDescription().then(setJob).catch(() => {});
    listSavedAnalyses().then(setAnalyses).catch(() => {});
  }, [user]);

  async function saveJob() {
    setJobMsg("Saving…");
    const res = await saveJobDescription(job);
    setJobMsg(res.error ? `Couldn't save: ${res.error}` : "✓ Saved — your AI conclusions will now use this context.");
  }

  async function open(id: string) {
    const loaded = await loadSavedAnalysis(id);
    if (loaded) window.location.href = "/view#" + (await encodeSpec(loaded.spec));
  }
  async function csv(id: string) {
    const loaded = await loadSavedAnalysis(id);
    if (loaded) downloadCsv(loaded.table, loaded.spec.datasetName);
  }
  async function remove(id: string) {
    await deleteSavedAnalysis(id);
    setAnalyses((a) => a.filter((x) => x.id !== id));
  }

  return (
    <main className="glow min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="brand-mark animate grid h-10 w-10 place-items-center rounded-xl text-lg font-black text-white">Q</div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-50">Quantia</h1>
              <p className="text-xs text-slate-400">Account</p>
            </div>
          </Link>
          <UserMenu />
        </header>

        {!enabled && <Card>Accounts aren&apos;t enabled on this deployment. The app still works fully as a guest.</Card>}

        {enabled && loading && <Card>Loading…</Card>}

        {enabled && !loading && !user && (
          <Card>
            <p className="text-slate-300">Sign in to save your analyses and personalize the AI.</p>
            <button onClick={() => setModal(true)} className="btn-shine mt-4 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400">Sign in</button>
            <AuthModal open={modal} onClose={() => setModal(false)} />
          </Card>
        )}

        {enabled && user && (
          <div className="space-y-6">
            <div className="card p-5 fade-up">
              <h2 className="text-base font-semibold text-slate-100">Your work context</h2>
              <p className="mt-1 text-xs text-slate-400">
                Describe your job, role, or what you're trying to learn from your data. The AI uses this to make its
                conclusions and answers more relevant to you. (Stored privately on your account — only you can see it.)
              </p>
              <textarea
                value={job}
                onChange={(e) => setJob(e.target.value)}
                rows={3}
                placeholder="e.g. I run a used-car dealership and want to understand why customers don't buy and which factors drive sales."
                className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
              />
              <div className="mt-3 flex items-center gap-3">
                <button onClick={saveJob} className="btn-shine rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">Save context</button>
                {jobMsg && <span className="text-xs text-indigo-300">{jobMsg}</span>}
              </div>
            </div>

            <div className="card p-5 fade-up">
              <h2 className="text-base font-semibold text-slate-100">Saved analyses</h2>
              <p className="mt-1 text-xs text-slate-400">Dashboards you saved from the analyzer. Open, download the data, or delete.</p>
              {analyses.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Nothing saved yet. Run an analysis and hit <span className="text-indigo-300">💾 Save</span>.{" "}
                  <Link href="/analyze" className="text-indigo-300 hover:text-indigo-200">Open the analyzer →</Link>
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-800">
                  {analyses.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-200">{a.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {a.row_count?.toLocaleString()} rows · {a.domain} · {new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => open(a.id)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800/60">Open</button>
                        <button onClick={() => csv(a.id)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800/60">CSV</button>
                        <button onClick={() => remove(a.id)} className="rounded-lg px-2 py-1.5 text-xs text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300">✕</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-center text-sm text-slate-300">{children}</div>;
}
