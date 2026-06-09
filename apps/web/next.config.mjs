// Security headers. The app is client-side and talks to its own origin; the optional LLM call is
// server-to-server from /api/insights (never browser→provider). Two OPT-IN, zero-data-egress features
// need narrow third-party allowances and so are whitelisted explicitly below:
//   • On-device model (transformers.js + WebGPU) — downloads PUBLIC model weights from Hugging Face and
//     the ONNX-runtime WASM from jsDelivr. No user data is sent; only public assets are fetched.
//   • Image OCR (tesseract.js) — downloads its WASM core/worker (jsDelivr) and language data.
// Both require WebAssembly, hence 'wasm-unsafe-eval'. Everything else stays locked down.
const HF = "https://huggingface.co https://*.huggingface.co https://*.hf.co";
const CDN = "https://cdn.jsdelivr.net"; // ONNX-runtime WASM (transformers.js) + tesseract.js worker/core/lang

const isDev = process.env.NODE_ENV !== "production";

// The browser POSTs the parsed data to the Python analysis backend (see lib/py-engine.ts). When that API
// is deployed as its OWN Vercel project (the robust setup, since Next.js shadows /api in the monorepo) the
// browser→API call is CROSS-ORIGIN, so its origin must be in `connect-src` or the CSP blocks the fetch and
// the app silently falls back to the in-browser TS engine. Derive the origin from NEXT_PUBLIC_PY_API; in
// dev also allow the local standalone server (py api/_server.py on 127.0.0.1/localhost).
let pyOrigin = "";
try {
  if (process.env.NEXT_PUBLIC_PY_API?.trim()) pyOrigin = new URL(process.env.NEXT_PUBLIC_PY_API.trim()).origin;
} catch {
  /* malformed URL → leave out; same-origin /api still works via 'self' */
}
const PY_API = [pyOrigin, isDev ? "http://127.0.0.1:* http://localhost:*" : ""].filter(Boolean).join(" ");

const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects a small inline bootstrap script; Tailwind/inline styles need 'unsafe-inline'.
  // 'wasm-unsafe-eval' lets the on-device model + OCR instantiate WebAssembly; the jsDelivr origin
  // serves the tesseract.js worker/core script. In DEV ONLY, 'unsafe-eval' is added so Next's React Fast
  // Refresh runtime (which evals) can run — without it the dev page throws on load and never hydrates.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""} ${CDN}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Fetches for model weights (Hugging Face) + runtime WASM and OCR worker/core/lang (jsDelivr) + the
  // Python analysis API (PY_API; same-origin /api is already covered by 'self').
  `connect-src 'self' ${HF} ${CDN} ${PY_API}`.trim(),
  `worker-src 'self' blob: ${CDN}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The on-device model (transformers.js) and its onnxruntime-node binaries are huge (~400MB) and are
  // used ONLY client-side (WebGPU in the browser). Next's build trace would otherwise bundle them into
  // the serverless function, blowing past Vercel's 250MB limit and failing the deploy. Exclude them from
  // server file-tracing — the client chunks are unaffected, so the browser feature still works.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@huggingface/**",
      "node_modules/onnxruntime-node/**",
      "**/node_modules/@huggingface/**",
      "**/node_modules/onnxruntime-node/**",
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
