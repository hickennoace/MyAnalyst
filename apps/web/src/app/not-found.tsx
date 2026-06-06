"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

export default function NotFound() {
  const t = useT();
  return (
    <main className="glow grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-2xl font-black text-white">
          Q
        </div>
        <p className="text-5xl font-extrabold tracking-tight text-slate-50">404</p>
        <p className="mt-2 text-slate-400">{t.notFound.msg}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/" className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400">
            {t.notFound.goHome}
          </Link>
          <Link href="/analyze" className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60">
            {t.notFound.openApp}
          </Link>
        </div>
      </div>
    </main>
  );
}
