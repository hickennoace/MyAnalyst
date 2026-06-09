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
    "numbers; you MAY divide two given figures to state a share/ratio. Lead with business meaning, not "
    "statistics; quantify the size of the opportunity or risk; be honest about uncertainty. Do NOT number "
    "the conclusions (no '1.', '2.' prefixes) — they render as a list. Output STRICT JSON: "
    '{"bottomLine": str, "summary": str, "chartInsights": [{"chart": str, "insight": str}], '
    '"conclusions": [str], "actions": [{"title": str, "detail": str}]}'
)


# Strip list enumeration the model adds itself ("1. …", "2) …", "3 - …") at the start of a line/clause —
# those ordinals are formatting, not data claims, and must not count as "figures to verify".
_ORDINAL = re.compile(r"(?m)(?:^|[;\n])\s*\d{1,2}\s*[.):\-]\s+")


def _num_tokens(text: str) -> set[str]:
    """Significant numbers in a string (ignores tiny ints/years/ordinals that are structural, not claims)."""
    text = _ORDINAL.sub(" ", text or "")
    out = set()
    for m in re.findall(r"-?\d[\d,]*\.?\d*", text):
        norm = m.replace(",", "")
        try:
            v = float(norm)
        except ValueError:
            continue
        if abs(v) >= 1 and not (1900 <= v <= 2100 and v == int(v) and len(norm) == 4):
            out.add(f"{v:g}")
    return out


def _derivable_percent(v: float, vals: list[float]) -> bool:
    """A percentage the model wrote (e.g. '20%') is grounded if it equals 100·a/b for a real pair of
    grounded values — covers shares/ratios computed from two facts (top customer ÷ total, etc.)."""
    if not (0 < v <= 100):
        return False
    for a in vals:
        for b in vals:
            if b > 0 and a <= b and abs(v - 100.0 * a / b) <= 0.6:
                return True
    return False


def check_grounding(answer: str, facts: list[dict]) -> dict:
    """Flag figures in the answer that don't trace to the grounded numbers (facts + KPIs + chart readings).

    A figure passes if it matches a grounded value within 2% (rounding), OR is a percentage derivable as a
    ratio of two grounded values. List ordinals and 4-digit years are never treated as claims.
    """
    fact_nums: set[str] = set()
    for f in facts:
        fact_nums |= _num_tokens(f.get("text", ""))
    fact_vals = [float(x) for x in fact_nums]
    unverified = []
    for tok in _num_tokens(answer):
        v = float(tok)
        # Match on MAGNITUDE — prose drops the sign ("fell 33.8%" vs a "-33.8%" trend KPI).
        if any(abs(abs(v) - abs(fv)) <= max(0.02 * abs(fv), 0.5) for fv in fact_vals):
            continue
        if _derivable_percent(abs(v), [abs(x) for x in fact_vals]):
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
    # A touch more room + warmth than the defaults: a full conclusion (bottom line + summary + up to 4
    # chart insights + 4 conclusions + 3 actions) must not truncate, and reads better slightly less terse.
    return _groq.chat([{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
                      temperature=0.45, max_tokens=2200)


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
            # Ground against EVERY number the model was shown — facts, KPI values, and chart readings —
            # so a figure lifted from a KPI (e.g. a trend %) isn't wrongly flagged "couldn't verify".
            ground_src = (
                list(facts)
                + [{"text": f"{k.get('name','')} {k.get('value','')}"} for k in (kpis or [])]
                + [{"text": c.get("reading", "")} for c in (chart_readings or [])]
            )
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
