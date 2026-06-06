import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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

// Set the theme + language/direction on <html> before first paint (no flash).
const THEME_INIT = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('quantia:theme');if(t!=='dark'&&t!=='light'){t='light';}d.dataset.theme=t;var l=localStorage.getItem('quantia:lang');if(l!=='he'&&l!=='en'){l='en';}d.lang=l;d.dir=l==='he'?'rtl':'ltr';}catch(e){var d2=document.documentElement;d2.dataset.theme='light';d2.lang='en';d2.dir='ltr';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
