import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Type system: a characterful optical serif for display, a clean grotesque for
// body/UI, and a mono for numerals & data labels (the "terminal" voice).
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://quantia.vercel.app";
const DESCRIPTION =
  "Upload a spreadsheet, get an instant, fully-explained analytical dashboard: KPIs, statistics, forecasts, and plain-language insights — automatically. Your data never leaves your browser.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Quantia — AI-assisted data analysis",
    template: "%s · Quantia",
  },
  description: DESCRIPTION,
  applicationName: "Quantia",
  keywords: ["data analysis", "dashboard", "KPI", "statistics", "forecast", "CSV", "Excel", "AI", "BI"],
  openGraph: {
    title: "Quantia — turn a spreadsheet into a beautiful dashboard",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Quantia",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quantia — AI-assisted data analysis",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
