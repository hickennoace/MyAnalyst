import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ScrollProgress } from "@/components/ScrollProgress";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

// Type system: one clean, neutral grotesque for everything (headings + body),
// and a mono for small numerals & data labels. Kept deliberately plain.
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://myanalyst.net";
const DESCRIPTION =
  "Upload a spreadsheet, get an instant, fully-explained analytical dashboard: KPIs, statistics, forecasts, and plain-language insights — automatically. Your data never leaves your browser.";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e16" },
  ],
};

// Set the theme on <html> before first paint to avoid a flash of the wrong theme.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('quantia:theme');if(t!=='dark'&&t!=='light'){t='light';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <ScrollProgress />
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
