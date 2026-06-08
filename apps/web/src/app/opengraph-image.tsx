import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Branded social-share card (used for OpenGraph + Twitter). Next generates this at build time and
// wires it into the metadata for every route, so links to the site preview with a real image.

export const alt = "MyAnalyst — turn a spreadsheet into a beautiful, explained dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The brand logo, inlined as a data URI so it renders inside the OG image (Satori has no filesystem).
const LOGO_DATA_URI = `data:image/png;base64,${readFileSync(join(process.cwd(), "public/logo.png")).toString("base64")}`;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          backgroundColor: "#0a0e16",
          backgroundImage:
            "radial-gradient(circle at 20% 0%, rgba(61,139,255,0.32), transparent 55%), radial-gradient(circle at 100% 100%, rgba(95,210,224,0.22), transparent 55%)",
          color: "#e2e8f0",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_DATA_URI} width={76} height={76} alt="MyAnalyst logo" style={{ borderRadius: "20px" }} />
          <div style={{ fontSize: "40px", fontWeight: 700, letterSpacing: "-0.02em" }}>MyAnalyst</div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ fontSize: "68px", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", maxWidth: "960px" }}>
            Turn a spreadsheet into a beautiful, explained dashboard.
          </div>
          <div style={{ fontSize: "30px", color: "#94a3b8", maxWidth: "900px", lineHeight: 1.3 }}>
            KPIs, statistics, forecasts, and plain-language insights — automatically. Your data never leaves your browser.
          </div>
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: "16px" }}>
          {["Cleaning report", "Statistical analysis", "Ask your data", "Private by design"].map((f) => (
            <div
              key={f}
              style={{
                display: "flex",
                fontSize: "24px",
                color: "#bcd2ff",
                padding: "10px 22px",
                borderRadius: "9999px",
                border: "1px solid rgba(61,139,255,0.45)",
                background: "rgba(61,139,255,0.10)",
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
