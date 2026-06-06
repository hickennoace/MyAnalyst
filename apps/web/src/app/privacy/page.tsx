"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LangToggle } from "@/components/LangToggle";
import { useLang, PRIVACY } from "@/lib/i18n";

export default function Privacy() {
  const [lang] = useLang();
  const t = PRIVACY[lang];

  return (
    <main className="glow min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 transition hover:text-slate-200">
            ← {t.back}
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
        <h1 className="mt-6 text-3xl font-bold text-slate-50">{t.title}</h1>
        <p className="mt-2 text-sm text-slate-400">{t.intro}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-300">
          {t.blocks.map((b) => (
            <section key={b.title}>
              <h2 className="text-base font-semibold text-slate-50">{b.title}</h2>
              <p className="mt-1.5">{b.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6">
          <Link href="/analyze" className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400">
            {t.cta} →
          </Link>
        </div>
      </div>
    </main>
  );
}
