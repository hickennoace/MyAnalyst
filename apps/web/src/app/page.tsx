import Link from "next/link";

// Marketing landing page. Static (server component) for fast first paint + SEO.
// The interactive product lives at /analyze.

const FEATURES = [
  { icon: "🧹", title: "Relentless cleaning", body: "Strips currency symbols, unifies date formats, removes duplicates, empty rows, and trailing totals — with a transparent before/after report." },
  { icon: "🧭", title: "Auto domain detection", body: "Figures out whether your data is financial, sales, marketing, or survey — and picks the metrics that matter for it." },
  { icon: "📊", title: "Instant KPIs & charts", body: "Ranked KPIs and the right charts for your data shape: trends, comparisons, correlations, distributions." },
  { icon: "🧮", title: "Real statistics", body: "Correlation, OLS regression with R², outlier detection, growth & volatility — computed exactly, locally." },
  { icon: "💬", title: "Plain-language insights", body: "Conclusions written in human language and grounded in the actual numbers — never hallucinated." },
  { icon: "✨", title: "Ask for any graph", body: "Type “revenue by region as a bar chart” and get it — or build one by picking columns." },
];

const STEPS = [
  { n: "1", title: "Upload", body: "Drop a CSV, TSV, or Excel file. Nothing is uploaded to a server — it's parsed in your browser." },
  { n: "2", title: "We analyze", body: "Clean → profile → detect domain → KPIs → statistics → charts → insights, in seconds." },
  { n: "3", title: "Explore", body: "Read your dashboard, generate extra charts, and understand your data — no skills required." },
];

export default function Landing() {
  return (
    <main className="glow min-h-screen">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Nav */}
        <nav className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-black text-white">Q</div>
            <span className="text-lg font-bold tracking-tight text-slate-50">Quantia</span>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <a href="#features" className="hidden text-slate-300 transition hover:text-white sm:block">Features</a>
            <a href="#how" className="hidden text-slate-300 transition hover:text-white sm:block">How it works</a>
            <Link href="/analyze" className="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-white transition hover:bg-indigo-400">
              Open the app
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="py-16 text-center sm:py-24">
          <div className="mx-auto mb-5 w-fit rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
            AI-assisted analysis · runs in your browser · no setup
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
            Turn a spreadsheet into a{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              beautiful dashboard
            </span>{" "}
            in seconds
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Upload your data and Quantia cleans it, finds the KPIs that matter, runs the right statistics,
            and explains what it all means — automatically. A zero-skill alternative to Power BI and Tableau.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/analyze" className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400">
              Analyze your data →
            </Link>
            <Link href="/analyze?demo=1" className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60">
              ▶ Try a live sample
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">No account. No upload. Your data never leaves this page.</p>
        </section>

        {/* Features */}
        <section id="features" className="py-14">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">Everything, automatically</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-slate-400">
            The work an analyst does by hand — done the moment your file lands.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6 transition hover:border-indigo-500/40">
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-slate-800/60 text-xl">{f.icon}</div>
                <h3 className="text-base font-semibold text-slate-100">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-14">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">Three steps</h2>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="card p-6">
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white">{s.n}</div>
                <h3 className="text-base font-semibold text-slate-100">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy / AI strip */}
        <section className="py-14">
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
                Works fully offline with a built-in narrator that writes insights from the real numbers.
                Want richer prose? Plug in any LLM — Claude, Groq, Gemini — with one environment variable.
                No key, no problem: it still works.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to see your data clearly?</h2>
          <Link href="/analyze" className="mt-6 inline-block rounded-xl bg-indigo-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400">
            Open Quantia →
          </Link>
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
