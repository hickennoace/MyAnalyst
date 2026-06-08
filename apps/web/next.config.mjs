// Strict, locked-down security headers. The app is fully client-side and talks ONLY to its own
// origin (the optional LLM call is server-to-server from /api/insights, never browser→provider),
// so the Content-Security-Policy can be tight: no third-party scripts, frames, or connections.

const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects a small inline bootstrap script; Tailwind/inline styles need 'unsafe-inline'.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
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
