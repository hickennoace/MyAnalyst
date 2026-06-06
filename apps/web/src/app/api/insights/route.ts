import { NextResponse } from "next/server";
import type { Insight, InsightContext } from "@/lib/types";

// Server-side insight narrator. The ONLY place the LLM API key lives — it is never shipped to the
// browser. The request body is an InsightContext: aggregates/stats only, never raw rows (the privacy
// boundary from docs/03-security-privacy.md). Provider-agnostic: Anthropic or any OpenAI-compatible API.
// With no key configured it returns an empty list and the client falls back to the templated narrator.

export const runtime = "nodejs";

type Provider = "anthropic" | "groq" | "openai" | "gemini" | "openrouter" | "openai-compat";

const OPENAI_COMPAT_BASES: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1",
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  openrouter: "https://openrouter.ai/api/v1",
};

const ALLOWED_KIND = new Set<Insight["kind"]>(["summary", "trend", "correlation", "regression", "outlier", "composition"]);
const ALLOWED_CONF = new Set<Insight["confidence"]>(["high", "medium", "low"]);

export async function POST(req: Request) {
  const provider = (process.env.LLM_PROVIDER ?? "groq") as Provider;
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim();

  // No key → signal the client to use its local templated narrator.
  if (!apiKey) {
    return NextResponse.json({ insights: [], provider: "none" });
  }

  let ctx: InsightContext;
  try {
    ctx = (await req.json()) as InsightContext;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!ctx || typeof ctx !== "object" || !Array.isArray(ctx.kpis)) {
    return NextResponse.json({ error: "Body must be an InsightContext." }, { status: 400 });
  }

  const validCites = collectValidCites(ctx);
  const { system, user } = buildPrompt(ctx, validCites);

  try {
    const raw =
      provider === "anthropic"
        ? await callAnthropic(apiKey, model ?? "claude-haiku-4-5", system, user)
        : await callOpenAICompat(provider, apiKey, model ?? "llama-3.3-70b-versatile", system, user);

    const insights = normalizeInsights(raw, validCites);
    return NextResponse.json({ insights, provider });
  } catch (err) {
    // Never break the dashboard on an LLM hiccup — fall back to templated on the client.
    console.error("[insights] LLM call failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ insights: [], provider: "error" });
  }
}

// ── Prompt ───────────────────────────────────────────────────────────────────

function collectValidCites(ctx: InsightContext): Set<string> {
  const ids = new Set<string>();
  for (const k of ctx.kpis) ids.add(k.id);
  for (const c of ctx.correlations) ids.add(`corr:${c.a}~${c.b}`);
  if (ctx.regression) ids.add("regression");
  for (const o of ctx.outliers) ids.add(`outlier:${o.column}`);
  for (const t of ctx.trends) ids.add(`trend:${t.metric}`);
  return ids;
}

function buildPrompt(ctx: InsightContext, validCites: Set<string>) {
  const system = [
    "You are a senior data analyst writing concise, plain-language insights for a non-technical user.",
    "You are given ONLY pre-computed statistics (KPIs, correlations, a regression, trends, outliers) — never raw data.",
    "Hard rules:",
    "1. Only state numbers that appear in the provided context. NEVER invent, round differently, or estimate numbers.",
    "2. Every insight must reference at least one id from the provided `validCites` list in its `cites` array.",
    "3. Be specific and actionable; avoid filler. Note when correlation does not imply causation.",
    "4. Return 4 to 6 insights, most important first.",
    'Respond with ONLY a JSON object: {"insights":[{"text":string,"confidence":"high"|"medium"|"low","kind":"summary"|"trend"|"correlation"|"regression"|"outlier"|"composition","cites":string[]}]}',
  ].join("\n");

  const user = JSON.stringify({ context: ctx, validCites: [...validCites] });
  return { system, user };
}

// ── Providers ─────────────────────────────────────────────────────────────────

async function callAnthropic(apiKey: string, model: string, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      // Prefill the assistant turn with "{" to force a JSON object response.
      messages: [
        { role: "user", content: user },
        { role: "assistant", content: "{" },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? "";
  return "{" + text;
}

async function callOpenAICompat(
  provider: Provider,
  apiKey: string,
  model: string,
  system: string,
  user: string
): Promise<string> {
  const base = process.env.LLM_BASE_URL?.trim() || OPENAI_COMPAT_BASES[provider];
  if (!base) throw new Error(`No base URL for provider "${provider}". Set LLM_BASE_URL.`);
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${provider} ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// ── Parsing & grounding guard ─────────────────────────────────────────────────

function extractJson(s: string): unknown {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("No JSON object in LLM response.");
  return JSON.parse(s.slice(start, end + 1));
}

function normalizeInsights(raw: string, validCites: Set<string>): Insight[] {
  const parsed = extractJson(raw) as { insights?: unknown };
  const list = Array.isArray(parsed.insights) ? parsed.insights : [];
  const out: Insight[] = [];
  for (let i = 0; i < list.length && out.length < 6; i++) {
    const it = list[i] as Record<string, unknown>;
    const text = String(it?.text ?? "").trim();
    if (!text) continue;
    const kind = ALLOWED_KIND.has(it?.kind as Insight["kind"]) ? (it.kind as Insight["kind"]) : "summary";
    const confidence = ALLOWED_CONF.has(it?.confidence as Insight["confidence"])
      ? (it.confidence as Insight["confidence"])
      : "medium";
    // Grounding guard: keep only cites the engine actually produced.
    const cites = Array.isArray(it?.cites)
      ? (it.cites as unknown[]).map(String).filter((c) => validCites.has(c))
      : [];
    out.push({ id: `ins-llm-${i}`, text, confidence, kind, cites });
  }
  return out;
}
