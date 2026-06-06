import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quantia — AI data analysis",
  description:
    "Upload a spreadsheet, get an instant, fully-explained analytical dashboard: KPIs, statistics, and plain-language insights — automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
