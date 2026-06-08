import type { DashboardSpec } from "./types";

// Shareable read-only links. The entire DashboardSpec is serialized, gzip-compressed (browser-native
// CompressionStream), and base64url-encoded into the URL HASH fragment — which browsers never send to
// the server. So a shared link reconstructs the dashboard entirely client-side; the data still never
// leaves the browser. No backend, no storage, no account.

/** Links beyond this many characters get unwieldy / may break in some apps — refuse and suggest PNG/PDF. */
export const MAX_LINK_CHARS = 200_000;

/** Compress any JSON-serializable value to a base64url string (gzip + base64url). */
export async function compress(value: unknown): Promise<string> {
  const bytes = await gzip(JSON.stringify(value));
  return bytesToB64url(bytes);
}

/** Inverse of compress(). */
export async function decompress<T>(payload: string): Promise<T> {
  const json = await gunzip(b64urlToBytes(payload));
  return JSON.parse(json) as T;
}

/**
 * Strip raw free-text excerpts before a spec leaves the device in a shareable link. The open-text
 * `sample` quotes are verbatim respondent text (possible PII); the rest of the spec is aggregate
 * metadata. A shared link reconstructs the dashboard without the quotes, while the live in-browser
 * analysis (and local history, which never leaves the device) keep them — upholding "raw rows never leave".
 */
export function redactForShare(spec: DashboardSpec): DashboardSpec {
  if (!spec.textAnalysis?.length) return spec;
  return {
    ...spec,
    textAnalysis: spec.textAnalysis.map((t) => ({
      ...t,
      terms: t.terms.map(({ sample: _sample, ...rest }) => rest),
    })),
  };
}

export const encodeSpec = (spec: DashboardSpec): Promise<string> => compress(redactForShare(spec));
export const decodeSpec = (payload: string): Promise<DashboardSpec> => decompress<DashboardSpec>(payload);

// ── gzip via CompressionStream, with a no-compression fallback for older browsers ────────────────

type StreamCtor = new (format: "gzip") => { writable: WritableStream; readable: ReadableStream };

async function gzip(text: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(text);
  const CS = (globalThis as { CompressionStream?: StreamCtor }).CompressionStream;
  if (!CS) return prefix(data, false);
  const cs = new CS("gzip");
  const writer = cs.writable.getWriter();
  void writer.write(data);
  void writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  return prefix(new Uint8Array(buf), true);
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const compressed = bytes[0] === 1;
  const body = bytes.subarray(1);
  if (!compressed) return new TextDecoder().decode(body);
  const DS = (globalThis as { DecompressionStream?: StreamCtor }).DecompressionStream;
  if (!DS) throw new Error("This browser can't read compressed share links.");
  const ds = new DS("gzip");
  const writer = ds.writable.getWriter();
  void writer.write(body);
  void writer.close();
  const buf = await new Response(ds.readable).arrayBuffer();
  return new TextDecoder().decode(buf);
}

/** Prepend a 1-byte header marking whether the payload is gzip-compressed. */
function prefix(body: Uint8Array, compressed: boolean): Uint8Array {
  const out = new Uint8Array(body.length + 1);
  out[0] = compressed ? 1 : 0;
  out.set(body, 1);
  return out;
}

// ── base64url <-> bytes ──────────────────────────────────────────────────────────────────────────

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
