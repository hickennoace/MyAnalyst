import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How MyAnalyst handles your data: processed securely on our server, never stored, AI sees only computed numbers.",
};

export default function Privacy() {
  return (
    <main className="glow min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 transition hover:text-slate-200">
            ← MyAnalyst
          </Link>
        </div>
        <h1 className="mt-6 text-3xl font-bold text-slate-50">Privacy</h1>
        <p className="mt-2 text-sm text-slate-400">
          Short version: your data is processed securely to build your dashboard, never stored, and never used
          for anything else. The AI only ever sees computed numbers — never your raw rows.
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-300">
          <Block title="How your file is processed">
            To compute your dashboard, your spreadsheet (a representative sample of large files) is sent over an
            encrypted HTTPS connection to MyAnalyst&apos;s analysis server, which runs the statistics in Python
            (pandas/scipy) and returns the results. It is processed only to produce <em>your</em> dashboard —
            it is <strong>not written to any database</strong>, not retained after the request, and never sold,
            shared, or used to train models. There are no user accounts.
          </Block>

          <Block title="The AI never sees your raw data">
            When the AI narrator writes the conclusions and insights, it receives only a <em>metadata-only</em>{" "}
            summary — column names and types, row counts, and the figures the engine already computed (KPI
            values, correlations, a regression, a forecast). Your individual rows are <strong>never</strong>{" "}
            sent to the language model.
          </Block>

          <Block title="What stays on your device">
            Recent analyses are stored only in your browser&apos;s <code className="text-blue-300">localStorage</code>{" "}
            — never synced anywhere; clearing your browser data removes them. PNG/PDF/report exports are generated
            locally. The optional on-device AI model (WebGPU) runs entirely in your browser with no network.
          </Block>

          <Block title="Shareable links">
            A share link encodes the dashboard into the URL&apos;s hash fragment (the part after
            <code className="text-blue-300"> # </code>). Browsers never send the hash to a server, so a shared
            dashboard is reconstructed entirely in the recipient&apos;s browser, and verbatim free-text values are
            redacted from it. Anyone with the link can view it — treat links like the data they contain.
          </Block>

          <Block title="No tracking">
            MyAnalyst ships no advertising or third-party analytics trackers.
          </Block>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6">
          <Link href="/analyze" className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400">
            Try the analyzer →
          </Link>
        </div>
      </div>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-50">{title}</h2>
      <p className="mt-1.5">{children}</p>
    </section>
  );
}
