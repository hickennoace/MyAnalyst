import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { ScrollProgress } from "@/components/ScrollProgress";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

// Type system: a clean neutral grotesque for body + UI, a mono for numerals & data labels, and a
// characterful display SERIF (Fraunces — optical sizing, soft brackets) for headlines. The serif gives the
// product an intelligent, editorial voice that sets it apart from the usual all-grotesque SaaS look, while
// data/UI stays in the crisp sans.
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
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://myanalyst.net";
const DESCRIPTION =
  "Upload a spreadsheet, get an instant, fully-explained analytical dashboard: KPIs, statistics, forecasts, and plain-language insights — automatically. Your data is processed securely, never stored, and never shared.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MyAnalyst — AI-assisted data analysis",
    template: "%s · MyAnalyst",
  },
  description: DESCRIPTION,
  applicationName: "MyAnalyst",
  keywords: ["data analysis", "dashboard", "KPI", "statistics", "forecast", "CSV", "Excel", "AI", "BI"],
  openGraph: {
    title: "MyAnalyst — turn a spreadsheet into a beautiful dashboard",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "MyAnalyst",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyAnalyst — AI-assisted data analysis",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, title: "MyAnalyst", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff6f0",
};

// The site ships a single bright theme — no light/dark switch. `data-theme="light"`
// is fixed on <html> so the shared app surfaces (and chart-theme's isLight()) stay
// bright. There is intentionally no theme-init script and no localStorage flag.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`} data-theme="light">
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <ScrollProgress />
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
