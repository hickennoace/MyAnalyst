import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { HeroChart } from "@/components/HeroChart";
import { HeroField } from "@/components/HeroField";
import { Magnetic } from "@/components/Magnetic";
import { Tilt } from "@/components/Tilt";
import { Stagger, StaggerItem, Float } from "@/components/Motion";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandMark";
import { DISCLAIMER_TEXT } from "@/components/Disclaimer";

// Marketing landing page. Static (server component) for fast first paint + SEO.
// Aesthetic: "Refined Light" — clean near-white SaaS canvas, a single indigo
// accent, solid fills, neutral type. Motion is CSS/SVG-driven; the product
// lives at /analyze.

// Crafted stroke icons (consistent 24-grid, 1.6px) — no emoji.
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
  { icon: I.broom, title: "Relentless cleaning", body: "Strips currency symbols, unifies date formats, removes duplicates, empty rows and trailing totals — with a transparent before/after report." },
  { icon: I.compass, title: "Auto domain detection", body: "Figures out whether your data is financial, sales, marketing or survey — and picks the metrics that matter for it." },
  { icon: I.bars, title: "Instant KPIs & charts", body: "Ranked KPIs and precise charts for your data shape: trends, comparisons, correlations, distributions." },
  { icon: I.sigma, title: "Real statistics", body: "Significance tests, OLS & multiple regression, ANOVA, chi-square, forecasting — statsmodels-grade rigor, in your browser." },
  { icon: I.quote, title: "Understands your data", body: "Reads the rows, columns and subject behind your file to explain what the dataset actually is — so every finding stays tied to your real-world context." },
  { icon: I.spark, title: "Ask your data", body: "Ask “which region sells best” or “what drives churn” and get a thorough, analyst-grade answer — grounded in your real numbers, with follow-ups to dig deeper." },
];

const STEPS = [
  { n: "01", title: "Upload", body: "Drop a CSV, TSV, Excel or JSON file — big CSVs stream up to ~1GB and are read right in your browser." },
  { n: "02", title: "We analyze", body: "Clean → profile → detect domain → KPIs → statistics → forecast → conclusions, in seconds — processed securely and never stored." },
  { n: "03", title: "Explore", body: "Read your dashboard, ask questions, generate charts, export & share — no skills required." },
];

const TICKER = ["Cleaning report", "Domain detection", "Ranked KPIs", "OLS regression", "ANOVA", "Chi-square", "Forecasting", "Correlation", "Distributions", "Plain-language insight"];

export default function Landing() {
  return (
    <main id="main-content" className="lp">
      <div className="lp-aurora" aria-hidden />
      <HeroField className="lp-field" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
        {/* Nav */}
        <nav className="flex items-center justify-between py-5" aria-label="Primary">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-9 w-9" />
            <span className="display text-xl text-[var(--ink)]">MyAnalyst</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <a href="#features" className="lp-link hidden sm:inline">Features</a>
            <a href="#how" className="lp-link hidden sm:inline">How it works</a>
            <ThemeToggle />
            <Link href="/analyze" className="lp-cta !px-4 !py-2 !text-[0.82rem]">Open the app</Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="grid items-center gap-12 pt-12 pb-16 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24">
          <Stagger mount>
            <StaggerItem>
              <h1 className="display text-[2.6rem] leading-[1.06] text-[var(--ink)] sm:text-[3.7rem]">
                Turn a spreadsheet into an{" "}
                <span className="lp-accent">explained dashboard</span>
              </h1>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-6 max-w-lg text-[1.05rem] leading-relaxed text-[var(--muted)]">
                MyAnalyst cleans your data, runs real statistics, and explains what it means —
                automatically. Upload a spreadsheet and get a clear, trustworthy dashboard in
                seconds, with the rigor of a working data scientist.
              </p>
            </StaggerItem>
            <StaggerItem>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Magnetic>
                  <Link href="/analyze" className="lp-cta">
                    Analyze your data
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link href="/analyze?demo=1" className="lp-ghost">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M7 5v14l11-7z" /></svg>
                    Try a live sample
                  </Link>
                </Magnetic>
              </div>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-5 text-[0.82rem] text-[var(--faint)]">No account · processed securely · never stored or shared.</p>
            </StaggerItem>
          </Stagger>

          {/* Chart panel — entrance, gentle idle float, and pointer tilt. */}
          <Reveal>
           <Float distance={6} duration={7}>
            <Tilt>
            <div className="lp-panel lp-panel-glow overflow-hidden p-4">
              <div className="flex items-center justify-between border-b border-[var(--line)] px-1 pb-3">
                <span className="lp-tape text-[var(--muted)]">revenue.csv · 12 periods</span>
                <span className="lp-tape lp-up">▲ +23.4%</span>
              </div>
              <div className="px-1 pt-3">
                <HeroChart className="w-full" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[["+23.4%", "growth"], ["0.47", "r · p<.001"], ["A+", "data quality"]].map(([v, l]) => (
                  <div key={l} className="rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] px-3 py-2.5">
                    <p className="mono text-[0.95rem] font-bold text-[var(--ink)]">{v}</p>
                    <p className="mt-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-[var(--faint)]">{l}</p>
                  </div>
                ))}
              </div>
            </div>
            </Tilt>
           </Float>
          </Reveal>
        </section>
      </div>

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
                The work a data scientist does by hand — done the moment your file lands.
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
                  Your file is sent over an encrypted connection only to build your dashboard, then discarded —
                  never written to a database, never sold or shared, no accounts. The AI only ever sees computed
                  numbers and column names — never your raw rows.
                </p>
              </div>
              <div className="lp-feature">
                <div className="lp-ico">{I.cpu}</div>
                <h3 className="mt-5 text-base font-semibold text-[var(--ink)]">Smart, your way</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  Works fully offline with a built-in engine that writes conclusions from real statistical
                  tests. Want richer prose? Plug in any LLM — Claude, Groq, Gemini — with one environment
                  variable. No key, no problem: it still works.
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── CTA ── */}
        <section className="py-16">
          <Reveal>
            <div className="lp-panel px-8 py-14 text-center sm:px-16">
              <h2 className="display mx-auto max-w-2xl text-[2rem] leading-tight text-[var(--ink)] sm:text-[2.6rem]">
                See your data <span className="lp-accent">clearly</span>.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[var(--muted)]">No setup, no spreadsheet skills, no waiting. Just answers.</p>
              <div className="mt-8 flex justify-center">
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
