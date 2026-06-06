"use client";

import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { HeroChart } from "@/components/HeroChart";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LangToggle } from "@/components/LangToggle";
import { useLang, LANDING } from "@/lib/i18n";

// Marketing landing page. Client component so the language toggle (EN ⇄ Hebrew,
// with RTL) re-renders content live. SSR still emits English HTML for SEO.
// Aesthetic: "Refined Light" — clean canvas, single indigo accent, neutral type.

// Crafted stroke icons (consistent 24-grid, 1.6px), paired by index with the
// translated feature list.
const ICONS = [
  <svg key="broom" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M14 3 8 9" /><path d="M5 19c0-2 1.5-3.5 3.5-3.5L11 13l-1 6Z" /><path d="M11 13l5-5 4 4-5 5" /><path d="M9 21h11" /></svg>,
  <svg key="compass" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /><circle cx="12" cy="12" r="1" /></svg>,
  <svg key="bars" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M3 21h18" /><rect x="5" y="11" width="3.4" height="6" rx="0.6" /><rect x="10.3" y="6" width="3.4" height="11" rx="0.6" /><rect x="15.6" y="13" width="3.4" height="4" rx="0.6" /></svg>,
  <svg key="sigma" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M17 5H7l5 7-5 7h10" /><path d="M17 5v2" /><path d="M17 19v-2" /></svg>,
  <svg key="quote" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M4 17h6l2-4V5H4v8h4Z" /><path d="M14 17h6l2-4V5h-8v8h4Z" /></svg>,
  <svg key="spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="M12 8.5 13 11l2.5 1L13 13l-1 2.5L11 13l-2.5-1L11 11Z" /></svg>,
];

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 rtl:-scale-x-100"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const LockIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" /></svg>
);
const CpuIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5"><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2" strokeLinecap="round" /></svg>
);

export default function Landing() {
  const [lang] = useLang();
  const t = LANDING[lang];

  return (
    <main id="main-content" className="lp">
      <div className="lp-aurora" aria-hidden />

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
        {/* Nav */}
        <nav className="flex items-center justify-between py-5" aria-label="Primary">
          <div className="flex items-center gap-3">
            <div className="lp-mark">Q</div>
            <span className="display text-xl text-[var(--ink)]">Quantia</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <a href="#features" className="lp-link hidden sm:inline">{t.nav.features}</a>
            <a href="#how" className="lp-link hidden sm:inline">{t.nav.how}</a>
            <LangToggle />
            <ThemeToggle />
            <Link href="/analyze" className="lp-cta !px-4 !py-2 !text-[0.82rem]">{t.nav.open}</Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="grid items-center gap-12 pt-12 pb-16 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24">
          <div className="fade-up">
            <span className="lp-pill"><i className="lp-dot" /> {t.hero.pill}</span>
            <h1 className="display mt-6 text-[2.6rem] leading-[1.06] text-[var(--ink)] sm:text-[3.7rem]">
              {t.hero.h1lead}{" "}
              <span className="lp-accent">{t.hero.h1accent}</span>
            </h1>
            <p className="mt-6 max-w-lg text-[1.05rem] leading-relaxed text-[var(--muted)]">{t.hero.sub}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/analyze" className="lp-cta">
                {t.hero.analyze}
                <Arrow />
              </Link>
              <Link href="/analyze?demo=1" className="lp-ghost">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 rtl:-scale-x-100"><path d="M7 5v14l11-7z" /></svg>
                {t.hero.sample}
              </Link>
            </div>
            <p className="mt-5 text-[0.82rem] text-[var(--faint)]">{t.hero.trust}</p>
          </div>

          {/* Chart panel */}
          <div>
            <div className="lp-panel overflow-hidden p-4">
              <div className="flex items-center justify-between border-b border-[var(--line)] px-1 pb-3">
                <span className="lp-tape text-[var(--muted)]" dir="ltr">{t.hero.tape}</span>
                <span className="lp-tape lp-up" dir="ltr">▲ +23.4%</span>
              </div>
              <div className="px-1 pt-3">
                <HeroChart className="w-full" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {([["+23.4%", t.hero.kpis[0]], ["0.47", t.hero.kpis[1]], ["A+", t.hero.kpis[2]]] as const).map(([v, l]) => (
                  <div key={l} className="rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] px-3 py-2.5">
                    <p className="mono text-[0.95rem] font-bold text-[var(--ink)]" dir="ltr">{v}</p>
                    <p className="mt-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-[var(--faint)]">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Capability ticker ── */}
      <div className="lp-ticker relative z-10">
        <div className="lp-ticker-track">
          {[...t.ticker, ...t.ticker].map((item, i) => (
            <span key={i} className="lp-ticker-item"><b>+</b> {item}</span>
          ))}
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
        {/* ── Features ── */}
        <section id="features" className="py-20">
          <Reveal>
            <div className="flex items-end justify-between gap-6">
              <div>
                <span className="lp-eyebrow">{t.features.eyebrow}</span>
                <h2 className="display mt-3 text-[1.9rem] text-[var(--ink)] sm:text-[2.4rem]">{t.features.title}</h2>
              </div>
              <p className="hidden max-w-xs text-sm leading-relaxed text-[var(--muted)] md:block">{t.features.sub}</p>
            </div>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.items.map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <article className="lp-feature">
                  <div className="flex items-start justify-between">
                    <div className="lp-ico">{ICONS[i]}</div>
                    <span className="lp-idx" dir="ltr">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-[var(--ink)]">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{f.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" className="py-12">
          <Reveal>
            <span className="lp-eyebrow">{t.method.eyebrow}</span>
            <h2 className="display mt-3 text-[1.9rem] text-[var(--ink)] sm:text-[2.4rem]">{t.method.title}</h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            {t.method.steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="lp-feature">
                  <p className="lp-step-n">{s.label}</p>
                  <h3 className="mt-3 text-base font-semibold text-[var(--ink)]">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Privacy / AI split ── */}
        <section className="py-12">
          <Reveal>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="lp-feature">
                <div className="lp-ico">{LockIcon}</div>
                <h3 className="mt-5 text-base font-semibold text-[var(--ink)]">{t.privacy.privTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{t.privacy.privBody}</p>
              </div>
              <div className="lp-feature">
                <div className="lp-ico">{CpuIcon}</div>
                <h3 className="mt-5 text-base font-semibold text-[var(--ink)]">{t.privacy.aiTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{t.privacy.aiBody}</p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── CTA ── */}
        <section className="py-16">
          <Reveal>
            <div className="lp-panel px-8 py-14 text-center sm:px-16">
              <h2 className="display mx-auto max-w-2xl text-[2rem] leading-tight text-[var(--ink)] sm:text-[2.6rem]">
                {t.cta.lead} <span className="lp-accent">{t.cta.accent}</span>.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[var(--muted)]">{t.cta.sub}</p>
              <div className="mt-8 flex justify-center">
                <Link href="/analyze" className="lp-cta">
                  {t.cta.open}
                  <Arrow />
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] py-8">
          <div className="flex items-center gap-3">
            <div className="lp-mark !h-8 !w-8 !text-base">Q</div>
            <span className="text-[0.82rem] text-[var(--faint)]">{t.footer.rights}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/analyze" className="lp-link">{t.footer.analyzer}</Link>
            <Link href="/privacy" className="lp-link">{t.footer.privacy}</Link>
            <span className="text-[0.82rem] text-[var(--faint)]">{t.footer.built}</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
