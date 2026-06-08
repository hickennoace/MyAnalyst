"""LLM conclusions from grounded facts (Groq, OpenAI-compatible) — with a zero-API fallback.

The engine computes FACTS; this turns them into a decision-first conclusion + a prioritized action plan.
The LLM may use ONLY numbers that appear in the facts (a grounding check flags any it invents). When no key
is set or the call fails/rate-limits, we return the deterministic templated narrative — the product never
depends on paid LLM capacity. Uses urllib (stdlib) so no SDK dependency is added.
"""
from __future__ import annotations

import json
import os
import re
import urllib.request

DISCLAIMER = ("Automated analysis — not financial or investment advice. Verify anything important "
              "with a qualified professional.")

SYSTEM = (
    "You are a principal data analyst writing for a busy operator. You are given COMPUTED FACTS from their "
    "data. Write a tight, decision-first read: a one-line bottom line, 2-4 conclusions (each: the number, "
    "what it means, the implication), and 1-3 prioritized actions. Rules: use ONLY figures that appear in "
    "the FACTS — never invent or extrapolate numbers; lead with the business meaning, not statistics; be "
    "concrete and honest about uncertainty. Output STRICT JSON: "
    '{"bottomLine": str, "conclusions": [str], "actions": [{"title": str, "detail": str}]}'
)


def _num_tokens(text: str) -> set[str]:
    """Significant numbers in a string (ignores tiny ints/years that are structural, not claims)."""
    out = set()
    for m in re.findall(r"-?\d[\d,]*\.?\d*", text or ""):
        norm = m.replace(",", "")
        try:
            v = float(norm)
        except ValueError:
            continue
        if abs(v) >= 1 and not (1900 <= v <= 2100 and v == int(v) and len(norm) == 4):
            out.add(f"{v:g}")
    return out


def check_grounding(answer: str, facts: list[dict]) -> dict:
    """Flag figures in the answer that don't trace to any fact (rounded match within 2%)."""
    fact_nums = set()
    for f in facts:
        fact_nums |= _num_tokens(f.get("text", ""))
    fact_vals = [float(x) for x in fact_nums]
    unverified = []
    for tok in _num_tokens(answer):
        v = float(tok)
        if any(abs(v - fv) <= max(0.02 * abs(fv), 0.5) for fv in fact_vals):
            continue
        unverified.append(tok)
    return {"grounded": not unverified, "unverified": unverified[:6]}


def call_groq(facts: list[dict], domain: str, user_context: str | None) -> str | None:
    key = os.environ.get("LLM_API_KEY")
    if not key:
        return None
    model = os.environ.get("LLM_MODEL", "openai/gpt-oss-120b")
    base = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    facts_text = "\n".join(f"- {f['text']}" for f in facts)
    user = f"Domain: {domain}.\n" + (f"User's goal: {user_context}.\n" if user_context else "") + \
           f"FACTS:\n{facts_text}\n\nWrite the JSON now."
    body = {
        "model": model,
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
    }
    if "gpt-oss" in model:  # reasoning model: keep thinking fast + hidden, don't starve output
        body["reasoning_effort"] = "low"
        body["max_tokens"] = 1600
    req = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"]
    except Exception:
        return None


def generate_conclusions(facts: list[dict], domain: str = "generic", user_context: str | None = None,
                         templated_fallback: str = "") -> dict:
    raw = call_groq(facts, domain, user_context)
    if raw:
        try:
            parsed = json.loads(raw)
            joined = " ".join([parsed.get("bottomLine", "")] + parsed.get("conclusions", [])
                              + [a.get("detail", "") for a in parsed.get("actions", [])])
            grounding = check_grounding(joined, facts)
            return {
                "provider": "groq",
                "bottomLine": parsed.get("bottomLine", ""),
                "conclusions": parsed.get("conclusions", [])[:4],
                "actions": parsed.get("actions", [])[:3],
                "grounding": grounding,
                "disclaimer": DISCLAIMER,
            }
        except Exception:
            pass
    # Fallback — deterministic, zero-API.
    return {
        "provider": "none",
        "bottomLine": templated_fallback or (facts[0]["text"] if facts else "No confident findings."),
        "conclusions": [f["text"] for f in facts[:4]],
        "actions": [],
        "grounding": {"grounded": True, "unverified": []},
        "disclaimer": DISCLAIMER,
    }
