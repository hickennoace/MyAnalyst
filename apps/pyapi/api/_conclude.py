"""LLM conclusions from grounded facts (Groq, OpenAI-compatible) — with a zero-API fallback.

The engine computes FACTS; this turns them into a decision-first conclusion + a prioritized action plan.
The LLM may use ONLY numbers that appear in the facts (a grounding check flags any it invents). When no key
is set or the call fails/rate-limits, we return the deterministic templated narrative — the product never
depends on paid LLM capacity. Uses urllib (stdlib) so no SDK dependency is added.
"""
from __future__ import annotations

import json
import re

import _groq

DISCLAIMER =("Automated analysis — not financial or investment advice. Verify anything important "
              "with a qualified professional.")

SYSTEM = (
    "You are a principal data analyst. A Python engine (pandas/statsmodels) has already CLEANED the data, "
    "computed the KPIs and statistics, and produced the CHARTS — your job is to read all of that and explain "
    "it to a busy operator. You are given the KPIs, the computed FACTS, and a plain-language READING of each "
    "chart the engine drew.\n"
    "Write: (1) bottomLine — one decisive sentence; (2) summary — a short paragraph (3-5 sentences) that "
    "explains what the data shows overall, weaving together the KPIs and what the charts reveal; "
    "(3) chartInsights — for the 2-4 most important charts, one sentence each interpreting what that chart "
    "MEANS for the business (reference the chart by its title); (4) conclusions — 2-4 crisp findings (number "
    "+ meaning + implication); (5) actions — 1-3 prioritized, concrete next steps.\n"
    "Rules: use ONLY figures that appear in the KPIs/FACTS/chart readings — never invent or extrapolate "
    "numbers; lead with business meaning, not statistics; be honest about uncertainty. Output STRICT JSON: "
    '{"bottomLine": str, "summary": str, "chartInsights": [{"chart": str, "insight": str}], '
    '"conclusions": [str], "actions": [{"title": str, "detail": str}]}'
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


def call_groq(facts: list[dict], domain: str, user_context: str | None,
              kpis: list[dict] | None = None, chart_readings: list[dict] | None = None) -> str | None:
    kpi_text = "\n".join(f"- {k['name']}: {k['value']}" for k in (kpis or []))
    facts_text = "\n".join(f"- {f['text']}" for f in facts)
    charts_text = "\n".join(f"- {c['title']}: {c['reading']}" for c in (chart_readings or []))
    user = (
        f"Domain: {domain}.\n" + (f"User's goal: {user_context}.\n" if user_context else "")
        + (f"\nKPIs:\n{kpi_text}\n" if kpi_text else "")
        + f"\nFACTS:\n{facts_text}\n"
        + (f"\nCHARTS the engine produced (read these and interpret them):\n{charts_text}\n" if charts_text else "")
        + "\nWrite the JSON now."
    )
    return _groq.chat([{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}])


def generate_conclusions(facts: list[dict], domain: str = "generic", user_context: str | None = None,
                         templated_fallback: str = "", kpis: list[dict] | None = None,
                         chart_readings: list[dict] | None = None) -> dict:
    raw = call_groq(facts, domain, user_context, kpis, chart_readings)
    if raw:
        try:
            parsed = json.loads(raw)
            chart_insights = parsed.get("chartInsights", [])[:4]
            joined = " ".join(
                [parsed.get("bottomLine", ""), parsed.get("summary", "")]
                + parsed.get("conclusions", [])
                + [ci.get("insight", "") for ci in chart_insights]
                + [a.get("detail", "") for a in parsed.get("actions", [])]
            )
            # Ground against facts + chart readings (the LLM is told to use only those numbers).
            ground_src = list(facts) + [{"text": c.get("reading", "")} for c in (chart_readings or [])]
            return {
                "provider": "groq",
                "bottomLine": parsed.get("bottomLine", ""),
                "summary": parsed.get("summary", ""),
                "chartInsights": chart_insights,
                "conclusions": parsed.get("conclusions", [])[:4],
                "actions": parsed.get("actions", [])[:3],
                "grounding": check_grounding(joined, ground_src),
                "disclaimer": DISCLAIMER,
            }
        except Exception:
            pass
    # Fallback — deterministic, zero-API.
    return {
        "provider": "none",
        "bottomLine": templated_fallback or (facts[0]["text"] if facts else "No confident findings."),
        "summary": templated_fallback,
        "chartInsights": [{"chart": c["title"], "insight": c["reading"]} for c in (chart_readings or [])[:4]],
        "conclusions": [f["text"] for f in facts[:4]],
        "actions": [],
        "grounding": {"grounded": True, "unverified": []},
        "disclaimer": DISCLAIMER,
    }
