import type { MetadataRoute } from "next";

// PWA manifest - makes MyAnalyst installable and lets the service worker serve it offline. Because the
// whole analysis engine runs client-side, an installed copy keeps working with no network at all.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyAnalyst - AI-assisted data analysis",
    short_name: "MyAnalyst",
    description:
      "Upload a spreadsheet, get an instant explained dashboard - KPIs, statistics, forecasts, and plain-language insights. Your data is processed securely, never stored, and never shared.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e16",
    theme_color: "#0a0e16",
    orientation: "any",
    categories: ["productivity", "business", "utilities"],
    icons: [
      { src: "/app-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
