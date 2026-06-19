import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { SpeedStreaks } from "@/components/SpeedStreaks";
import { DataCore } from "@/components/DataCore";
import { Magnetic } from "@/components/Magnetic";
import { BrandMark } from "@/components/BrandMark";
import { DISCLAIMER_TEXT } from "@/components/Disclaimer";

// Marketing landing page. Static (server component) for fast first paint + SEO.
// Aesthetic: "Refined Light" - clean near-white SaaS canvas, a single indigo
// accent, solid fills, neutral type. Motion is CSS/SVG-driven; the product
// lives at /analyze.

// Crafted stroke icons (consistent 24-grid, 1.6px) - no emoji.
const I = {
  broom: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M14 3 8 9" /><path d="M5 19c0-2 1.5-3.5 3.5-3.5L11 13l-1 6Z" /><path d="M11 13l5-5 4 4-5 5" /><path d="M9 21h11" />
    </svg>
  ),
  compass: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /><circle cx="12" cy="12" r="1" />
    </svg>
  ),
  bars: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M3 21h18" /><rect x="5" y="11" width="3.4" height="6" rx="0.6" /><rect x="10.3" y="6" width="3.4" height="11" rx="0.6" /><rect x="15.6" y="13" width="3.4" height="4" rx="0.6" />
    </svg>
  ),
  sigma: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17 5H7l5 7-5 7h10" /><path d="M17 5v2" /><path d="M17 19v-2" />
    </svg>
  ),
  quote: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 17h6l2-4V5H4v8h4Z" /><path d="M14 17h6l2-4V5h-8v8h4Z" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="M12 8.5 13 11l2.5 1L13 13l-1 2.5L11 13l-2.5-1L11 11Z" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  cpu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="7" y="7" width="10" height="10" rx="2" /><path d="M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2" />
    </svg>
  ),
};

const FEATURES = [
  { icon: I.broom, title: "Relentless cleaning", body: "Strips currency symbols, unifies date formats, removes duplicates, empty rows and trailing totals - with a transparent before/after report." },
  { icon: I.compass, title: "Auto domain detection", body: "Figures out whether your data is financial, sales, marketing or survey - and picks the metrics that matter for it." },
  { icon: I.bars, title: "Instant KPIs & charts", body: "Ranked KPIs and precise charts for your data shape: trends, comparisons, correlations, distributions." },
  { icon: I.sigma, title: "Real statistics", body: "Significance tests, OLS & multiple regression, ANOVA, chi-square, forecasting - statsmodels-grade rigor, in your browser." },
  { icon: I.quote, title: "Understands your data", body: "Reads the rows, columns and subject behind your file to explain what the dataset actually is - so every finding stays tied to your real-world context." },
  { icon: I.spark, title: "Ask your data", body: "Ask “which region sells best” or “what drives churn” and get a thorough, analyst-grade answer - grounded in your real numbers, with follow-ups to dig deeper." },
];

const STEPS = [
  { n: "01", title: "Upload", body: "Drop a CSV, TSV, Excel or JSON file - big CSVs stream up to ~1GB and are read right in your browser." },
  { n: "02", title: "We analyze", body: "Clean → profile → detect domain → KPIs → statistics → forecast → conclusions, in seconds - processed securely and never stored." },
  { n: "03", title: "Explore", body: "Read your dashboard, ask questions, generate charts, export & share - no skills required." },
];

const TICKER = ["Cleaning report", "Domain detection", "Ranked KPIs", "OLS regression", "ANOVA", "Chi-square", "Forecasting", "Correlation", "Distributions", "Plain-language insight"];

export default function Landing() {
  return (
    <main id="main-content" className="lp grain-layer">
      {/* Site-wide faint warp backdrop - carries the hero's motion language behind
          every section (fixed, decorative). */}
      <div className="lp-warp" aria-hidden />

      {/* ── Cinematic hero band (bright luminous, motion-forward) ── */}
      <section className="cine">
        <div className="cine-grid" aria-hidden />
        <div className="cine-glow" aria-hidden />
        <SpeedStreaks className="cine-streaks" />

        <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
          {/* Nav */}
          <nav className="flex items-center justify-between py-5" aria-label="Primary">
            <div className="flex items-center gap-2.5">
              <BrandMark className="h-9 w-9" />
              <span className="text-xl font-extrabold tracking-tight text-[var(--c-ink)]">MyAnalyst</span>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              <a href="#features" className="cine-nav-link hidden sm:inline">Features</a>
              <a href="#how" className="cine-nav-link hidden sm:inline">How it works</a>
              <Link href="/analyze" className="cine-cta !px-4 !py-2 !text-[0.82rem]">Open the app</Link>
            </div>
          </nav>

          {/* ── Hero ── */}
          <section className="relative grid items-center gap-10 pt-10 pb-20 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:pb-28">
            <div>
              <h1 className="cine-title cine-rise text-[2.9rem] text-[var(--c-ink)] sm:text-[4.4rem]" style={{ animationDelay: "0.05s" }}>
                Turn raw data<br />into <span className="cine-accent">answers</span>
              </h1>
              <p className="cine-rise mt-6 max-w-lg text-[1.05rem] leading-relaxed text-[var(--c-muted)]" style={{ animationDelay: "0.18s" }}>
                MyAnalyst cleans your spreadsheet, runs real statistics, and explains what it means -
                automatically. Drop in a file and watch a clear, trustworthy dashboard build itself in
                seconds, with the rigor of a working data scientist.
              </p>
              <div className="cine-rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "0.3s" }}>
                <Magnetic>
                  <Link href="/analyze" className="cine-cta">
                    Analyze your data
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link href="/analyze?demo=1" className="cine-ghost">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M7 5v14l11-7z" /></svg>
                    Try a live sample
                  </Link>
                </Magnetic>
              </div>
              <p className="cine-rise mt-6 text-[0.82rem] text-[var(--c-faint)]" style={{ animationDelay: "0.42s" }}>No account · processed securely · never stored or shared.</p>
            </div>

            {/* Animated data core - the data-themed centerpiece. */}
            <div className="relative">
              <DataCore />
              <div className="cine-card">
                <span className="cine-card-ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M3 21h18" /><path d="M5 17l4-5 3 3 5-7" /><path d="M17 8h3v3" /></svg>
                </span>
                <div>
                  <p className="text-[0.9rem] font-semibold text-[var(--c-ink)]">Live analysis</p>
                  <p className="text-[0.72rem] text-[var(--c-muted)]">+23.4% trend · r=0.47 · p&lt;.001</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      {/* ── Capability ticker ── */}
      <div className="lp-ticker relative z-10">
        <div className="lp-ticker-track">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="lp-ticker-item"><b>+</b> {t}</span>
          ))}
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
        {/* ── Features ── */}
        <section id="features" className="py-20">
          <Reveal>
            <div className="flex items-end justify-between gap-6">
              <div>
                <span className="lp-eyebrow">Capabilities</span>
                <h2 className="display mt-3 text-[1.9rem] text-[var(--ink)] sm:text-[2.4rem]">Everything, automatically</h2>
              </div>
              <p className="hidden max-w-xs text-sm leading-relaxed text-[var(--muted)] md:block">
                The work a data scientist does by hand - done the moment your file lands.
              </p>
            </div>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <article className="lp-feature">
                  <div className="flex items-start justify-between">
                    <div className="lp-ico">{f.icon}</div>
                    <span className="lp-idx">{String(i + 1).padStart(2, "0")}</span>
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
            <span className="lp-eyebrow">The method</span>
            <h2 className="display mt-3 text-[1.9rem] text-[var(--ink)] sm:text-[2.4rem]">Three steps, no friction</h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="lp-feature">
                  <p className="lp-step-n">STEP {s.n}</p>
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
                <div className="lp-ico">{I.lock}</div>
                <h3 className="mt-5 text-base font-semibold text-[var(--ink)]">Private by design</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  Your file is sent over an encrypted connection only to build your dashboard, then discarded -
                  never written to a database, never sold or shared, no accounts. The AI only ever sees computed
                  numbers and column names - never your raw rows.
                </p>
              </div>
              <div className="lp-feature">
                <div className="lp-ico">{I.cpu}</div>
                <h3 className="mt-5 text-base font-semibold text-[var(--ink)]">Smart, your way</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  Works fully offline with a built-in engine that writes conclusions from real statistical
                  tests. Want richer prose? Plug in any LLM - Claude, Groq, Gemini - with one environment
                  variable. No key, no problem: it still works.
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── CTA ── */}
        <section className="py-16">
          <Reveal>
            <div className="lp-panel lp-cta-band px-8 py-14 text-center sm:px-16">
              <div className="lp-cta-grid" aria-hidden />
              <div className="lp-cta-glow" aria-hidden />
              <h2 className="display relative z-10 mx-auto max-w-2xl text-[2rem] leading-tight text-[var(--ink)] sm:text-[2.6rem]">
                See your data <span className="lp-accent">clearly</span>.
              </h2>
              <p className="relative z-10 mx-auto mt-4 max-w-md text-[var(--muted)]">No setup, no spreadsheet skills, no waiting. Just answers.</p>
              <div className="relative z-10 mt-8 flex justify-center">
                <Magnetic>
                  <Link href="/analyze" className="lp-cta">
                    Open MyAnalyst
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                </Magnetic>
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="border-t border-[var(--line)] py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BrandMark className="h-8 w-8" />
              <span className="text-[0.82rem] text-[var(--faint)]">© 2026 MyAnalyst · autonomous statistical analysis</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/analyze" className="lp-link">Analyzer</Link>
              <Link href="/privacy" className="lp-link">Privacy</Link>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-[0.72rem] leading-relaxed text-[var(--faint)]">{DISCLAIMER_TEXT}</p>
        </footer>
      </div>
    </main>
  );
}
