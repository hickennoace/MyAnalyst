import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Quantia handles your data: it doesn't leave your browser.",
};

export default function Privacy() {
  return (
    <main className="glow min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 transition hover:text-slate-200">
            ← Quantia
          </Link>
          <ThemeToggle />
        </div>
        <h1 className="mt-6 text-3xl font-bold text-slate-50">Privacy</h1>
        <p className="mt-2 text-sm text-slate-400">Short version: your data stays on your device.</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-300">
          <Block title="Your files never leave your browser">
            Parsing, cleaning, profiling, KPIs, statistics, forecasting, charts, and the templated
            insights all run locally in your browser using JavaScript. Quantia has no upload endpoint
            and no database for your data. Nothing is transmitted to a server to produce your dashboard.
          </Block>

          <Block title="Local history">
            Recent analyses are stored only in your browser's <code className="text-blue-300">localStorage</code>,
            on this device. Clearing your browser data removes them. They are never synced anywhere.
          </Block>

          <Block title="Shareable links">
            A share link encodes the whole dashboard into the URL's hash fragment (the part after
            <code className="text-blue-300"> # </code>). Browsers never send the hash to a server, so a
            shared dashboard is reconstructed entirely in the recipient's browser. Anyone with the link
            can view it — treat links like the data they contain.
          </Block>

          <Block title="Optional AI narration">
            If — and only if — the operator enables the optional LLM narrator, a small <em>metadata-only</em>{" "}
            summary (KPI values, correlations, a regression, a forecast — never your raw rows) is sent to the
            configured model provider to phrase the written insights. With AI disabled, even that doesn't leave
            your browser.
          </Block>

          <Block title="No tracking">
            Quantia ships no advertising or third-party analytics trackers.
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
