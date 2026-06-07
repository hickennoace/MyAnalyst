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

// Sensible default model per provider, used when LLM_MODEL isn't set. (Previously every
// OpenAI-compatible provider defaulted to a groq-specific llama model, so switching to e.g. Gemini
// without also setting LLM_MODEL silently sent an invalid model id.)
const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-haiku-4-5",
  groq: "llama-3.3-70b-versatile",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash",
  openrouter: "meta-llama/llama-3.3-70b-instruct",
  "openai-compat": "",
};

const ALLOWED_KIND = new Set<Insight["kind"]>(["summary", "trend", "correlation", "regression", "outlier", "composition"]);
const ALLOWED_CONF = new Set<Insight["confidence"]>(["high", "medium", "low"]);

export async function POST(req: Request) {
  const provider = (process.env.LLM_PROVIDER ?? "groq") as Provider;
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim() || DEFAULT_MODELS[provider] || "";

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

  const callLLM = (system: string, user: string, opts?: CallOpts) =>
    provider === "anthropic"
      ? callAnthropic(apiKey, model || "claude-haiku-4-5", system, user, opts)
      : callOpenAICompat(provider, apiKey, model || "llama-3.3-70b-versatile", system, user, opts);

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
      meta?: { datasetName?: string; domain?: string; rowCount?: number; columns?: { name: string; role: string; type: string }[]; userContext?: string };
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

  // Task: answer — answer a plain-English "Ask your data" question as a thorough, professional analyst,
  // grounded strictly in pre-computed numbers (aggregates only; never raw rows). Returns prose + follow-ups.
  if (body && typeof body === "object" && (body as { task?: string }).task === "answer") {
    const { question, dataset, grounded, facts } = body as {
      question?: string;
      dataset?: unknown;
      grounded?: string;
      facts?: unknown;
    };
    if (!question || typeof question !== "string") {
      return NextResponse.json({ answer: "", provider: "error" });
    }
    const { overview, intent, conversation, scope, stream } = body as {
      overview?: unknown;
      intent?: string;
      conversation?: unknown;
      scope?: unknown;
      stream?: boolean;
    };

    // Streaming mode: emit the answer prose token-by-token as plain text. Followups are generated
    // locally on the client in this mode. On any upstream failure we return a non-2xx so the client
    // falls back to the non-streaming JSON path (and then to the heuristic answer).
    if (stream === true) {
      try {
        const { system, user } = buildAnswerPrompt(question, dataset, grounded, facts, overview, intent, conversation, scope, true);
        const streamBody = await streamLLM(provider, apiKey, model, system, user, { temperature: 0.45, maxTokens: 1800 });
        return new Response(streamBody, {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
      } catch (err) {
        console.error("[insights] answer (stream) failed:", err instanceof Error ? err.message : err);
        return new Response("", { status: 502 });
      }
    }

    try {
      const { system, user } = buildAnswerPrompt(question, dataset, grounded, facts, overview, intent, conversation, scope);
      const raw = await callLLM(system, user, { temperature: 0.45, maxTokens: 1800 });
      const parsed = extractJson(raw) as { answer?: unknown; followups?: unknown; chart?: unknown };
      const answer = String(parsed.answer ?? "").trim();
      if (!answer) return NextResponse.json({ answer: "", provider: "error" });
      const followups = Array.isArray(parsed.followups)
        ? (parsed.followups as unknown[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 3)
        : [];
      // Pass the model's chart choice through untouched; the client validates it against real columns
      // (it only chooses a type + column names — never raw chart config).
      const chart = parsed.chart && typeof parsed.chart === "object" ? parsed.chart : null;
      return NextResponse.json({ answer, followups, chart, provider });
    } catch (err) {
      console.error("[insights] answer failed:", err instanceof Error ? err.message : err);
      return NextResponse.json({ answer: "", provider: "error" });
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
  meta: { datasetName?: string; domain?: string; rowCount?: number; columns?: { name: string; role: string; type: string }[]; userContext?: string }
) {
  const system = [
    "You are a sharp data analyst. From dataset METADATA ONLY (column names + roles, detected domain, row count) and a rough draft, write a crisp, specific description of what the dataset is.",
    "Cover, in 3–4 natural sentences: the likely industry/subject; what a single row represents; what it mainly measures and the dimensions it's broken down by; and what people use data like this for.",
    "Be concrete and confident, but NEVER invent specific facts, numbers, names, or claims not implied by the column names and roles. You are given no raw data rows — do not pretend to know specific values.",
    meta.userContext ? `The user described their goal: "${meta.userContext}". Frame the description around that goal.` : "(No user goal provided.)",
    "Also return a short industry/subject label of at most 4 words.",
    'Respond with ONLY JSON: {"story":{"industry":string,"summary":string}}',
  ].join("\n");
  const user = JSON.stringify({ draft, meta });
  return { system, user };
}

// ── Ask-your-data answer prompt ────────────────────────────────────────────────

function buildAnswerPrompt(
  question: string,
  dataset: unknown,
  grounded: unknown,
  facts: unknown,
  overview: unknown,
  intent: unknown,
  conversation: unknown,
  scope: unknown,
  stream = false
) {
  const system = [
    "You are a principal data analyst — the kind a company pays for — writing a precise, insightful answer to a question about the user's dataset. Sound like a sharp human expert, not a chatbot.",
    "INPUTS you are given (all pre-computed; you have NO raw rows):",
    "• QUESTION — what the user asked.",
    "• dataset — metadata: column names, roles, types, fill rates, row count, detected domain, and (if provided) the user's own description of their goal in `userContext`.",
    "• grounded — a one-line result the deterministic engine already computed for this exact question (authoritative; present for specific questions).",
    "• facts — question-specific numbers: the focal `breakdown`, plus `breakdowns` (the focal metric across up to two dimensions, so you can reason over multiple facets in one answer), trends, distributions, the cited correlation, and for an 'X vs Y' question a `comparison` block with each side's value, the gap, % difference, ratio, and which side is higher.",
    "• overview — an always-available statistical brief of the WHOLE dataset: every key metric's total/average/median/std-dev/spread (coefficient of variation)/skew/fill-rate, the strongest pairwise correlations, category concentration, and any overall time trend. Use this to answer open-ended questions and to add context.",
    "• scope — if present, the user's question is FILTERED to a subset (e.g. one region, one year, a numeric range). `facts` and `grounded` are already computed on that subset only; `matchedRows`/`ofRows` show how many rows it covers. Make the scope explicit in your answer, and you MAY contrast the subset with the whole-dataset `overview` for context.",
    "• conversation — recent prior questions and your answers in this session, if any.",
    "CONVERSATION: If the question refers back to earlier turns ('that region', 'those', 'compare it to the previous', 'why?'), resolve the reference from `conversation` and answer in continuity — like a real analyst mid-discussion. Don't repeat earlier explanations verbatim; build on them.",
    "Note on group breakdowns: each group carries BOTH a `total` and an `average` (with row `count`). Use the one the question calls for — totals for 'biggest/most revenue', averages for 'highest average / per-order / most efficient'. `highestAverage` names the leader by average, which can differ from the leader by total.",
    "GROUNDING RULES (critical):",
    "1. Every figure you state must come from the inputs — OR be a transparent arithmetic derivation of them (a difference, ratio, multiple, percentage, or share). Deriving '$1.24M is 1.4× the $890K runner-up' from two given numbers is encouraged; inventing a number that isn't derivable is forbidden.",
    "2. Never fabricate values, individual records, causes you can't see, or external facts. If the data can't fully answer, say precisely what's missing.",
    "3. Respect data quality: if a relevant column has a low fill rate, the dataset was sampled, a group is tiny, or a correlation is weak — say so plainly. A real analyst flags caveats.",
    "HOW TO WRITE:",
    "4. Open with a one-sentence BOTTOM LINE that directly answers the question with the key number(s).",
    "5. Then give the supporting analysis: the comparison/gap/ranking, the share of total, magnitude, and the most relevant correlation or trend — always with the actual numbers. Quantify everything; no vague filler like 'various factors' or 'it depends'.",
    "6. Then interpret: what this likely MEANS in the context of the detected domain and the user's stated goal, and one concrete, specific next step or thing to check. Distinguish correlation from causation when relevant.",
    "7. Voice: confident, concrete, and clear for a smart non-statistician. Explain any stats term in plain words. 2–4 short paragraphs, ~110–200 words. Separate paragraphs with a blank line (\\n\\n).",
    "8. If `userContext` is present, frame the whole answer around that goal — emphasis, examples, and the recommended next step should serve it.",
    ...(stream
      ? ["Write the answer as plain prose only — no JSON, no preamble, no headings. Separate paragraphs with a blank line."]
      : [
          "9. Propose up to 3 incisive follow-up questions the user would realistically ask next, each tied to this dataset's real columns and phrased the way they'd type it.",
          "10. Pick the SINGLE most illuminating chart to accompany your answer, using ONLY exact column names from `dataset.columns`. Conventions: line = a metric over the time column; bar with `aggregate:true` = a metric summed by a dimension (x = the dimension, y = [the metric]); bar with `count:true` and `y:[]` = how often each value of a category occurs; scatter = two metrics (x and y = [the other]); histogram = one metric's distribution (x = y[0] = the metric); pie = share of a category (x = the category, `count:true`). If no chart genuinely helps, set chart to null.",
          'Respond with ONLY JSON: {"answer": string, "followups": string[], "chart": {"type":"line"|"bar"|"scatter"|"area"|"pie"|"histogram","x":string,"y":string[],"aggregate"?:boolean,"count"?:boolean} | null}',
        ]),
  ].join("\n");
  const user = JSON.stringify({ question, intent: intent ?? "specific", scope, conversation, dataset, grounded, facts, overview });
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
    "7. NO OBVIOUS OR TAUTOLOGICAL INSIGHTS. Skip anything a reader already knows by definition: a metric correlating with a column derived from it (tax↔sales, total↔price×quantity, a unit conversion, a near-perfect r≈1.0 link), or merely restating a KPI's value as if it were a finding. If a 'relationship' is true by construction, it is not an insight — drop it and surface something non-obvious instead. Prefer fewer, genuinely informative insights over filler.",
    'Respond with ONLY a JSON object: {"insights":[{"text":string,"confidence":"high"|"medium"|"low","kind":"summary"|"trend"|"correlation"|"regression"|"outlier"|"composition","cites":string[]}]}',
  ].join("\n");

  const user = JSON.stringify({ context: ctx, validCites: [...validCites] });
  return { system, user };
}

// ── Providers ─────────────────────────────────────────────────────────────────

interface CallOpts {
  temperature?: number;
  maxTokens?: number;
}

// Rate limits (429) and transient 5xx are common on free tiers. Retry a couple of times with a short,
// capped backoff (honoring Retry-After) so a brief per-minute limit doesn't drop us to the templated
// fallback. Caps keep us well within the serverless function timeout; a hard daily-quota 429 will still
// exhaust the retries and fall back gracefully.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
async function fetchWithRetry(url: string, init: RequestInit, retries = 1): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if (res.ok || attempt >= retries || !RETRYABLE.has(res.status)) return res;
    const retryAfter = Number(res.headers.get("retry-after"));
    // A long retry-after means an hourly/daily quota that won't clear within this request — fail fast
    // to the templated/heuristic fallback instead of stalling. Only short (per-minute) limits retry.
    if (Number.isFinite(retryAfter) && retryAfter > 8) return res;
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(400 * 2 ** attempt, 2000);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

async function callAnthropic(apiKey: string, model: string, system: string, user: string, opts?: CallOpts): Promise<string> {
  const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: opts?.maxTokens ?? 2048,
      ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
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
  user: string,
  opts?: CallOpts
): Promise<string> {
  const base = process.env.LLM_BASE_URL?.trim() || OPENAI_COMPAT_BASES[provider];
  if (!base) throw new Error(`No base URL for provider "${provider}". Set LLM_BASE_URL.`);
  const res = await fetchWithRetry(`${base}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: opts?.temperature ?? 0.3,
      max_tokens: opts?.maxTokens ?? 2048,
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

// ── Streaming (Ask-your-data) ─────────────────────────────────────────────────
// Returns a ReadableStream of plain-text answer deltas, decoded from the provider's SSE stream.

async function streamLLM(
  provider: Provider,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  opts?: CallOpts
): Promise<ReadableStream<Uint8Array>> {
  if (provider === "anthropic") {
    const upstream = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: opts?.maxTokens ?? 2048,
        ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
        system,
        stream: true,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!upstream.ok || !upstream.body) throw new Error(`Anthropic ${upstream.status}: ${await upstream.text()}`);
    return sseToText(upstream.body, (j) => {
      const o = j as { type?: string; delta?: { text?: string } };
      return o.type === "content_block_delta" ? o.delta?.text ?? "" : "";
    });
  }

  const baseUrl = process.env.LLM_BASE_URL?.trim() || OPENAI_COMPAT_BASES[provider];
  if (!baseUrl) throw new Error(`No base URL for provider "${provider}". Set LLM_BASE_URL.`);
  const upstream = await fetchWithRetry(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: opts?.temperature ?? 0.3,
      max_tokens: opts?.maxTokens ?? 2048,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!upstream.ok || !upstream.body) throw new Error(`${provider} ${upstream.status}: ${await upstream.text()}`);
  return sseToText(upstream.body, (j) => {
    const o = j as { choices?: { delta?: { content?: string } }[] };
    return o.choices?.[0]?.delta?.content ?? "";
  });
}

/** Transform an upstream SSE byte stream into a plain-text stream via a per-event extractor. */
function sseToText(
  body: ReadableStream<Uint8Array>,
  extract: (json: unknown) => string
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (data === "[DONE]") {
          controller.close();
          return;
        }
        try {
          const piece = extract(JSON.parse(data));
          if (piece) controller.enqueue(encoder.encode(piece));
        } catch {
          /* ignore keep-alive pings / non-JSON lines */
        }
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
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
