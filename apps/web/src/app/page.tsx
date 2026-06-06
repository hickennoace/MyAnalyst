import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { HeroChart } from "@/components/HeroChart";

// Marketing landing page. Static (server component) for fast first paint + SEO.
// Aesthetic: "quant terminal × editorial" — ink canvas, graph-paper texture,
// serif display + mono numerals, one disciplined signal-lime accent. Motion is
// CSS/SVG-driven; the interactive product lives at /analyze.

// Crafted stroke icons (consistent 24-grid, 1.5px) — no emoji.
const I = {
  broom: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M14 3 8 9" /><path d="M5 19c0-2 1.5-3.5 3.5-3.5L11 13l-1 6Z" />
      <path d="M11 13l5-5 4 4-5 5" /><path d="M9 21h11" />
    </svg>
  ),
  compass: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /><circle cx="12" cy="12" r="1" />
    </svg>
  ),
  bars: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M3 21h18" /><rect x="5" y="11" width="3.4" height="6" rx="0.6" /><rect x="10.3" y="6" width="3.4" height="11" rx="0.6" /><rect x="15.6" y="13" width="3.4" height="4" rx="0.6" />
    </svg>
  ),
  sigma: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17 5H7l5 7-5 7h10" /><path d="M17 5v2" /><path d="M17 19v-2" />
    </svg>
  ),
  quote: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 17h6l2-4V5H4v8h4Z" /><path d="M14 17h6l2-4V5h-8v8h4Z" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="M12 8.5 13 11l2.5 1L13 13l-1 2.5L11 13l-2.5-1L11 11Z" />
    </svg>
  ),
};

const FEATURES = [
  { icon: I.broom, title: "Relentless cleaning", body: "Strips currency symbols, unifies date formats, removes duplicates, empty rows and trailing totals — with a transparent before/after report." },
  { icon: I.compass, title: "Auto domain detection", body: "Figures out whether your data is financial, sales, marketing or survey — and picks the metrics that matter for it." },
  { icon: I.bars, title: "Instant KPIs & charts", body: "Ranked KPIs and precise charts for your data shape: trends, comparisons, correlations, distributions." },
  { icon: I.sigma, title: "Real statistics", body: "Significance tests, OLS & multiple regression, ANOVA, chi-square, forecasting — statsmodels-grade rigor, in your browser." },
  { icon: I.quote, title: "Conclusions, not just charts", body: "Plain-language, statistically-calibrated takeaways grounded in the numbers — it tells you what it likely means." },
  { icon: I.spark, title: "Ask your data", body: "Type “which reason is most common” or “revenue by region as a bar chart” and get an answer — in plain English." },
];

const STEPS = [
  { n: "01", title: "Upload", body: "Drop a CSV, TSV, Excel or JSON file. Nothing is sent to a server — it's parsed entirely in your browser." },
  { n: "02", title: "We analyze", body: "Clean → profile → detect domain → KPIs → statistics → forecast → conclusions, in seconds." },
  { n: "03", title: "Explore", body: "Read your dashboard, ask questions, generate charts, export & share — no skills required." },
];

const TICKER = ["Cleaning report", "Domain detection", "Ranked KPIs", "OLS regression", "ANOVA", "Chi-square", "Forecasting", "Correlation", "Distributions", "Plain-language insight"];

export default function Landing() {
  return (
    <main id="main-content" className="lp">
      {/* Ambient layers */}
      <div className="lp-canvas" aria-hidden />
      <div className="lp-glow" aria-hidden />
      <div className="lp-grain" aria-hidden />

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
        {/* Status bar */}
        <div className="flex items-center justify-between pt-5 text-[var(--faint)]">
          <span className="mono text-[0.66rem] tracking-[0.18em]">QUANTIA · STATISTICAL ANALYSIS ENGINE</span>
          <span className="mono hidden text-[0.66rem] tracking-[0.18em] sm:inline">CLIENT-SIDE · v1.0 · 2026</span>
        </div>
        <div className="lp-rule mt-4" />

        {/* Nav */}
        <nav className="flex items-center justify-between py-5" aria-label="Primary">
          <div className="flex items-center gap-3">
            <div className="lp-mono-mark"><span>Q</span></div>
            <span className="display text-xl font-semibold tracking-tight text-[var(--text)]">Quantia</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="lp-link hidden sm:inline">/features</a>
            <a href="#how" className="lp-link hidden sm:inline">/method</a>
            <Link href="/analyze" className="lp-cta !px-4 !py-2 !text-[0.82rem]">Open the app</Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="grid items-center gap-12 pt-10 pb-16 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24">
          <div className="fade-up">
            <span className="lp-eyebrow"><i className="lp-dot" /> AI-assisted · runs in your browser · no setup</span>
            <h1 className="display mt-6 text-[2.7rem] font-semibold leading-[1.02] tracking-tight text-[var(--text)] sm:text-[4rem]">
              A spreadsheet in.
              <br />
              <span className="italic text-[var(--signal)]">An explained</span>{" "}
              <span className="text-[var(--text)]">dashboard</span> out.
            </h1>
            <p className="mt-7 max-w-lg text-[1.02rem] leading-relaxed text-[var(--muted)]">
              Quantia cleans your data, runs real statistics, and writes the conclusions —
              automatically. A zero-skill alternative to Power BI and Tableau, with the rigor of a
              working data scientist.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/analyze" className="lp-cta">
                Analyze your data
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link href="/analyze?demo=1" className="lp-ghost">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M7 5v14l11-7z" /></svg>
                Try a live sample
              </Link>
            </div>
            <p className="mt-5 mono text-[0.72rem] tracking-wide text-[var(--faint)]">// no account · no upload · your data never leaves this page</p>
          </div>

          {/* Terminal panel */}
          <div className="animate-float">
            <div className="lp-panel overflow-hidden p-4">
              <div className="flex items-center justify-between border-b border-[var(--hair)] px-1 pb-3">
                <span className="lp-tape text-[var(--muted)]">revenue.csv · 12 periods</span>
                <span className="lp-tape lp-up">▲ +23.4%</span>
              </div>
              <div className="px-1 pt-3">
                <HeroChart className="w-full" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[["+23.4%", "growth"], ["0.47", "r · p<.001"], ["A+", "data quality"]].map(([v, l]) => (
                  <div key={l} className="rounded-lg border border-[var(--hair)] bg-[rgba(255,255,255,0.015)] px-3 py-2.5">
                    <p className="mono text-[0.95rem] font-semibold text-[var(--text)]">{v}</p>
                    <p className="mono mt-0.5 text-[0.6rem] uppercase tracking-[0.12em] text-[var(--faint)]">{l}</p>
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
                <h2 className="display mt-3 text-[2rem] font-semibold tracking-tight text-[var(--text)] sm:text-[2.6rem]">Everything, automatically</h2>
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
                  <h3 className="mt-5 text-base font-semibold text-[var(--text)]">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{f.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Method ── */}
        <section id="how" className="py-20">
          <Reveal>
            <span className="lp-eyebrow">The method</span>
            <h2 className="display mt-3 text-[2rem] font-semibold tracking-tight text-[var(--text)] sm:text-[2.6rem]">Three steps, no friction</h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[var(--hair)] md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="h-full bg-[rgba(255,255,255,0.012)] p-7">
                  <p className="lp-step-n"><em>{s.n.slice(0, 1)}</em>{s.n.slice(1)}</p>
                  <h3 className="mt-5 text-base font-semibold text-[var(--text)]">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Privacy / AI split ── */}
        <section className="py-12">
          <Reveal>
            <div className="lp-panel grid grid-cols-1 gap-px overflow-hidden md:grid-cols-2">
              <div className="bg-[rgba(255,255,255,0.012)] p-8">
                <div className="lp-eyebrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" /></svg> Private by design</div>
                <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                  All parsing, cleaning, KPIs, statistics and charts run entirely in your browser. Your raw
                  rows never touch a server. When AI narration is enabled, only small aggregate statistics —
                  never your underlying data — are sent for wording.
                </p>
              </div>
              <div className="bg-[rgba(255,255,255,0.012)] p-8">
                <div className="lp-eyebrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" strokeLinecap="round" /></svg> Smart, your way</div>
                <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                  Works fully offline with a built-in engine that writes conclusions from real statistical
                  tests. Want richer prose? Plug in any LLM — Claude, Groq, Gemini — with one environment
                  variable. No key, no problem: it still works.
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── CTA ── */}
        <section className="py-24 text-center">
          <Reveal>
            <span className="lp-eyebrow justify-center">Ready when you are</span>
            <h2 className="display mx-auto mt-5 max-w-2xl text-[2.2rem] font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-[3.2rem]">
              See your data <span className="italic text-[var(--signal)]">clearly.</span>
            </h2>
            <div className="mt-8 flex justify-center">
              <Link href="/analyze" className="lp-cta">
                Open Quantia
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            </div>
          </Reveal>
        </section>

        <div className="lp-rule" />
        <footer className="flex flex-wrap items-center justify-between gap-4 py-8">
          <div className="flex items-center gap-3">
            <div className="lp-mono-mark !h-8 !w-8"><span className="!text-base">Q</span></div>
            <span className="mono text-[0.72rem] text-[var(--faint)]">© 2026 Quantia · autonomous statistical analysis</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/analyze" className="lp-link">/analyzer</Link>
            <Link href="/privacy" className="lp-link">/privacy</Link>
            <span className="lp-link">built on Next.js · Vercel</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
