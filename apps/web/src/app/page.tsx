import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { HeroChart } from "@/components/HeroChart";

// Marketing landing page. Static (server component) for fast first paint + SEO.
// Motion is CSS/SVG-driven; the interactive product lives at /analyze.

const FEATURES = [
  { icon: "🧹", title: "Relentless cleaning", body: "Strips currency symbols, unifies date formats, removes duplicates, empty rows, and trailing totals — with a transparent before/after report." },
  { icon: "🧭", title: "Auto domain detection", body: "Figures out whether your data is financial, sales, marketing, or survey — and picks the metrics that matter for it." },
  { icon: "📊", title: "Instant KPIs & charts", body: "Ranked KPIs and beautiful charts for your data shape: trends, comparisons, correlations, distributions." },
  { icon: "🧮", title: "Real statistics", body: "Significance tests, OLS & multiple regression, ANOVA, chi-square, forecasting — statsmodels-grade rigor, in your browser." },
  { icon: "💬", title: "Conclusions, not just charts", body: "Plain-language, statistically-calibrated takeaways grounded in the numbers — it tells you what it likely means." },
  { icon: "✨", title: "Ask your data", body: "Type “which reason is most common” or “revenue by region as a bar chart” and get an answer — in plain English." },
];

const STEPS = [
  { n: "1", title: "Upload", body: "Drop a CSV, TSV, Excel, or JSON file. Nothing is uploaded to a server — it's parsed in your browser." },
  { n: "2", title: "We analyze", body: "Clean → profile → detect domain → KPIs → statistics → forecast → conclusions, in seconds." },
  { n: "3", title: "Explore", body: "Read your dashboard, ask questions, generate charts, export & share — no skills required." },
];

export default function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Animated aurora backdrop */}
      <div className="aurora">
        <span className="a1" />
        <span className="a2" />
        <span className="a3" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* Nav */}
        <nav className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="brand-mark animate grid h-10 w-10 place-items-center rounded-xl text-lg font-black text-white shadow-lg shadow-indigo-500/30">Q</div>
            <span className="text-lg font-bold tracking-tight text-slate-50">Quantia</span>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <a href="#features" className="hidden text-slate-300 transition hover:text-white sm:block">Features</a>
            <a href="#how" className="hidden text-slate-300 transition hover:text-white sm:block">How it works</a>
            <Link href="/analyze" className="btn-shine rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-white transition hover:bg-indigo-400">
              Open the app
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="grid items-center gap-10 py-12 sm:py-20 lg:grid-cols-2">
          <div className="fade-up text-center lg:text-left">
            <div className="mx-auto mb-5 w-fit rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 lg:mx-0">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400 align-middle type-caret" />
              AI-assisted analysis · runs in your browser · no setup
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl">
              Turn a spreadsheet into a{" "}
              <span className="text-gradient">beautiful, explained dashboard</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-slate-400 lg:mx-0">
              Upload your data and Quantia cleans it, runs real statistics, and writes the conclusions —
              automatically. A zero-skill alternative to Power BI and Tableau, with the rigor of a data scientist.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link href="/analyze" className="btn-shine rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400">
                Analyze your data →
              </Link>
              <Link href="/analyze?demo=1" className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-indigo-400/60 hover:bg-slate-800/60">
                ▶ Try a live sample
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">No account. No upload. Your data never leaves this page.</p>
          </div>

          <div className="animate-float">
            <div className="card relative overflow-hidden p-4">
              <div className="mb-3 flex items-center gap-1.5 px-1">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-2 text-[11px] text-slate-500">revenue · last 12 periods</span>
              </div>
              <HeroChart className="w-full" />
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[["+23.4%", "growth"], ["0.47", "r, p<.001"], ["A+", "data quality"]].map(([v, l]) => (
                  <div key={l} className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                    <p className="text-sm font-bold text-slate-100">{v}</p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-14">
          <Reveal>
            <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">Everything, automatically</h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-slate-400">The work a data scientist does by hand — done the moment your file lands.</p>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 70}>
                <div className="card card-hover h-full p-6">
                  <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-slate-800/60 text-xl">{f.icon}</div>
                  <h3 className="text-base font-semibold text-slate-100">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-14">
          <Reveal>
            <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">Three steps</h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div className="card card-hover h-full p-6">
                  <div className="brand-mark mb-3 grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white">{s.n}</div>
                  <h3 className="text-base font-semibold text-slate-100">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Privacy / AI strip */}
        <section className="py-14">
          <Reveal>
            <div className="card grid grid-cols-1 gap-6 p-8 md:grid-cols-2">
              <div>
                <h3 className="text-lg font-semibold text-white">🔒 Private by design</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  All parsing, cleaning, KPIs, statistics, and charts run entirely in your browser. Your raw
                  rows never touch a server. When AI narration is enabled, only small aggregate statistics —
                  never your underlying data — are sent for wording.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">🤖 Smart, your way</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Works fully offline with a built-in engine that writes conclusions from real statistical
                  tests. Want richer prose? Plug in any LLM — Claude, Groq, Gemini — with one environment
                  variable. No key, no problem: it still works.
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* CTA */}
        <section className="py-16 text-center">
          <Reveal>
            <h2 className="text-3xl font-bold text-white">Ready to see your data clearly?</h2>
            <Link href="/analyze" className="btn-shine mt-6 inline-block rounded-xl bg-indigo-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400">
              Open Quantia →
            </Link>
          </Reveal>
        </section>

        <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-slate-800 py-8 text-center text-xs text-slate-600">
          <span>Quantia — autonomous financial &amp; statistical analysis.</span>
          <Link href="/analyze" className="text-slate-500 transition hover:text-slate-300">Analyzer</Link>
          <Link href="/privacy" className="text-slate-500 transition hover:text-slate-300">Privacy</Link>
          <span>Built with Next.js, runs on Vercel.</span>
        </footer>
      </div>
    </main>
  );
}
