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

  // No key → signal the client to use its local templated narrator / original conclusions.
  if (!apiKey) {
    return NextResponse.json({ insights: [], conclusions: [], provider: "none" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const callLLM = (system: string, user: string) =>
    provider === "anthropic"
      ? callAnthropic(apiKey, model ?? "claude-haiku-4-5", system, user)
      : callOpenAICompat(provider, apiKey, model ?? "llama-3.3-70b-versatile", system, user);

  // Task: humanize — rewrite the deterministic conclusions in a warm, human tone (numbers preserved).
  if (body && typeof body === "object" && (body as { task?: string }).task === "humanize") {
    const { conclusions, userContext } = body as { conclusions?: { id: string; text: string; detail?: string }[]; userContext?: string };
    if (!Array.isArray(conclusions) || conclusions.length === 0) {
      return NextResponse.json({ conclusions: [] });
    }
    try {
      const { system, user } = buildHumanizePrompt(conclusions, userContext);
      const raw = await callLLM(system, user);
      return NextResponse.json({ conclusions: normalizeHumanized(raw, conclusions), provider });
    } catch (err) {
      console.error("[insights] humanize failed:", err instanceof Error ? err.message : err);
      return NextResponse.json({ conclusions: [], provider: "error" });
    }
  }

  // Task: story — sharpen the "what is this data" description from dataset metadata.
  if (body && typeof body === "object" && (body as { task?: string }).task === "story") {
    const { draft, meta } = body as {
      draft?: { industry?: string; summary?: string };
      meta?: { datasetName?: string; domain?: string; rowCount?: number; columns?: { name: string; role: string; type: string }[] };
    };
    try {
      const { system, user } = buildStoryPrompt(draft ?? {}, meta ?? {});
      const raw = await callLLM(system, user);
      const parsed = extractJson(raw) as { story?: { industry?: unknown; summary?: unknown } };
      const industry = String(parsed.story?.industry ?? draft?.industry ?? "").trim().slice(0, 60);
      const summary = String(parsed.story?.summary ?? "").trim();
      if (!summary) return NextResponse.json({ story: null, provider: "error" });
      return NextResponse.json({ story: { industry: industry || (draft?.industry ?? ""), summary }, provider });
    } catch (err) {
      console.error("[insights] story failed:", err instanceof Error ? err.message : err);
      return NextResponse.json({ story: null, provider: "error" });
    }
  }

  // Default task: generate grounded insights from an InsightContext.
  const ctx = body as InsightContext;
  if (!ctx || typeof ctx !== "object" || !Array.isArray(ctx.kpis)) {
    return NextResponse.json({ error: "Body must be an InsightContext." }, { status: 400 });
  }
  const validCites = collectValidCites(ctx);
  const { system, user } = buildPrompt(ctx, validCites);
  try {
    const insights = normalizeInsights(await callLLM(system, user), validCites);
    return NextResponse.json({ insights, provider });
  } catch (err) {
    console.error("[insights] LLM call failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ insights: [], provider: "error" });
  }
}

// ── Humanize conclusions ──────────────────────────────────────────────────────

function buildHumanizePrompt(conclusions: { id: string; text: string; detail?: string }[], userContext?: string) {
  const system = [
    "You are a warm, friendly analyst explaining findings to someone with NO statistics background.",
    "Rewrite each conclusion so it sounds natural and human — like a smart colleague talking, not a textbook.",
    "HARD RULES:",
    "1. Keep the exact meaning and EVERY specific number/percentage/name. Never invent or change facts or numbers.",
    "2. Plain everyday language, no jargon. 1–2 short sentences each. Encouraging, clear, concrete.",
    userContext ? `3. The reader's context: "${userContext}". Tailor wording/examples to that.` : "3. (No extra context.)",
    'Respond with ONLY JSON: {"conclusions":[{"id":string,"text":string}]} — same ids you were given.',
  ].join("\n");
  const user = JSON.stringify({ conclusions: conclusions.map((c) => ({ id: c.id, text: c.text, detail: c.detail })) });
  return { system, user };
}

function normalizeHumanized(raw: string, original: { id: string }[]): { id: string; text: string }[] {
  const parsed = extractJson(raw) as { conclusions?: { id?: unknown; text?: unknown }[] };
  const list = Array.isArray(parsed.conclusions) ? parsed.conclusions : [];
  const valid = new Set(original.map((c) => c.id));
  const out: { id: string; text: string }[] = [];
  for (const it of list) {
    const id = String(it?.id ?? "");
    const text = String(it?.text ?? "").trim();
    if (valid.has(id) && text) out.push({ id, text });
  }
  return out;
}

// ── Story prompt ───────────────────────────────────────────────────────────────

function buildStoryPrompt(
  draft: { industry?: string; summary?: string },
  meta: { datasetName?: string; domain?: string; rowCount?: number; columns?: { name: string; role: string; type: string }[] }
) {
  const system = [
    "You are a sharp data analyst. From dataset METADATA ONLY (column names + roles, detected domain, row count) and a rough draft, write a crisp, specific description of what the dataset is.",
    "Cover, in 2–3 natural sentences: the likely industry/subject; what a single row represents; what it mainly measures (and the breakdown dimensions); and what people use data like this for.",
    "Be concrete and confident, but NEVER invent specific facts, numbers, names, or claims not implied by the column names and roles. You are given no raw data rows — do not pretend to know specific values.",
    "Also return a short industry/subject label of at most 4 words.",
    'Respond with ONLY JSON: {"story":{"industry":string,"summary":string}}',
  ].join("\n");
  const user = JSON.stringify({ draft, meta });
  return { system, user };
}

// ── Prompt ───────────────────────────────────────────────────────────────────

function collectValidCites(ctx: InsightContext): Set<string> {
  const ids = new Set<string>();
  for (const k of ctx.kpis ?? []) ids.add(k.id);
  for (const c of ctx.correlations ?? []) ids.add(`corr:${c.a}~${c.b}`);
  if (ctx.regression) ids.add("regression");
  if (ctx.forecast) ids.add("forecast");
  for (const o of ctx.outliers ?? []) ids.add(`outlier:${o.column}`);
  for (const t of ctx.trends ?? []) ids.add(`trend:${t.metric}`);
  for (const c of ctx.categories ?? []) ids.add(`category:${c.column}`);
  for (const g of ctx.groupComparisons ?? []) ids.add(`anova:${g.metric}~${g.dimension}`);
  for (const a of ctx.associations ?? []) ids.add(`assoc:${a.a}~${a.b}`);
  if (ctx.drivers) ids.add("drivers");
  return ids;
}

function buildPrompt(ctx: InsightContext, validCites: Set<string>) {
  const system = [
    "You are a warm, friendly analyst explaining what the data means to someone with NO statistics background — like a smart colleague talking them through it over coffee.",
    "You are given ONLY pre-computed statistics (KPIs, correlations, a regression, trends, outliers) — never raw data.",
    "Hard rules:",
    "1. Only state numbers that appear in the provided context. NEVER invent, round differently, or estimate numbers.",
    "2. Every insight must reference at least one id from the provided `validCites` list in its `cites` array.",
    "3. Write in plain, everyday language — no jargon, no statistics terms (say 'these move together', not 'correlation r='). Keep each insight to 1–2 short, natural sentences.",
    "4. Make it useful: say what it likely MEANS and what the reader could DO about it. Gently note when something could just be coincidence, and that things moving together doesn't prove one causes the other.",
    "5. If the context includes `userContext` (the user's job/goal), tailor your wording, emphasis, and examples to that goal.",
    "6. Return 4 to 6 insights, most important first.",
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
