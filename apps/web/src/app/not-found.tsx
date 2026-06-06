import Link from "next/link";

export default function NotFound() {
  return (
    <main className="glow grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-2xl font-black text-white">
          Q
        </div>
        <p className="text-5xl font-extrabold tracking-tight text-white">404</p>
        <p className="mt-2 text-slate-400">This page wandered off the dashboard.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/" className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400">
            Go home
          </Link>
          <Link href="/analyze" className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60">
            Open the analyzer
          </Link>
        </div>
      </div>
    </main>
  );
}
