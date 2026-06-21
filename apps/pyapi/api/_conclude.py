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
    "You are a sharp analyst explaining a dataset to a SMART FRIEND WHO HAS NO BUSINESS OR STATISTICS "
    "BACKGROUND. A Python engine (pandas/statsmodels) has already CLEANED the data, computed the KPIs and "
    "statistics, and produced the CHARTS — your job is to read all of that and explain what it means in "
    "everyday words. You are given the KPIs, the computed FACTS, and a plain-language READING of each chart "
    "the engine drew.\n"
    "Write: (1) bottomLine — one short, decisive sentence a non-expert instantly gets; (2) summary — a short "
    "paragraph (3-5 sentences) that explains what the data shows overall, weaving together the KPIs and what "
    "the charts reveal; (3) chartInsights — for the 2-4 most important charts, one sentence each saying what "
    "that chart MEANS in practice (reference the chart by its title); (4) conclusions — 2-4 crisp findings "
    "(the number + what it means + why it matters); (5) actions — 1-3 prioritized, concrete next steps "
    "phrased as plain instructions someone could act on tomorrow.\n"
    "PLAIN-LANGUAGE RULES (critical): write so ANYONE can understand — short sentences, everyday words, no "
    "jargon. NEVER use a statistics term without explaining it in the same breath (say 'these rise and fall "
    "together' not 'correlated'; 'the usual middle value' not 'median'; 'a real pattern, not luck' not "
    "'statistically significant'; 'the top few account for most of it' not 'Pareto'). Spell out what each "
    "number means for a real person, not just what it is.\n"
    "GROUNDING RULES: use ONLY figures that appear in the KPIs/FACTS/chart readings — never invent or "
    "extrapolate numbers; you MAY divide two given figures to state a share/ratio. Quantify the size of the "
    "opportunity or risk in plain terms, and be honest about uncertainty. Do NOT number the conclusions "
    "(no '1.', '2.' prefixes) — they render as a list. Output STRICT JSON: "
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


def _build_messages(facts: list[dict], domain: str, user_context: str | None,
                    kpis: list[dict] | None, chart_readings: list[dict] | None) -> list[dict]:
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
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]


def call_groq(facts: list[dict], domain: str, user_context: str | None,
              kpis: list[dict] | None = None, chart_readings: list[dict] | None = None) -> str | None:
    # A touch more room + warmth than the defaults: a full conclusion (bottom line + summary + up to 4
    # chart insights + 4 conclusions + 3 actions) must not truncate, and reads better slightly less terse.
    return _groq.chat(_build_messages(facts, domain, user_context, kpis, chart_readings),
                      temperature=0.45, max_tokens=2200)


def _ground_sources(facts: list[dict], kpis: list[dict] | None, chart_readings: list[dict] | None) -> list[dict]:
    """Every number the model was shown — facts, KPI values, chart readings — so a figure lifted from a KPI
    (e.g. a trend %) isn't wrongly flagged "couldn't verify"."""
    return (
        list(facts)
        + [{"text": f"{k.get('name','')} {k.get('value','')}"} for k in (kpis or [])]
        + [{"text": c.get("reading", "")} for c in (chart_readings or [])]
    )


def _result_from_raw(raw: str | None, ground_src: list[dict]) -> dict | None:
    """Parse the model's JSON into the conclusion shape + a grounding verdict, or None if unusable."""
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except Exception:
        return None
    chart_insights = parsed.get("chartInsights", [])[:4]
    actions = parsed.get("actions", [])[:3]
    # Ground EVERYTHING the reader will see — including action TITLES and chart-insight text, which previously
    # escaped the check — so an invented figure can't hide in a heading.
    joined = " ".join(
        [parsed.get("bottomLine", ""), parsed.get("summary", "")]
        + parsed.get("conclusions", [])
        + [ci.get("insight", "") for ci in chart_insights]
        + [a.get("title", "") for a in actions]
        + [a.get("detail", "") for a in actions]
    )
    return {
        "provider": "groq",
        "bottomLine": parsed.get("bottomLine", ""),
        "summary": parsed.get("summary", ""),
        "chartInsights": chart_insights,
        "conclusions": parsed.get("conclusions", [])[:4],
        "actions": actions,
        "grounding": check_grounding(joined, ground_src),
        "disclaimer": DISCLAIMER,
    }


def _repair_prompt(unverified: list[str]) -> str:
    return (
        "Some figures in your previous answer could not be verified against the data you were given: "
        + ", ".join(unverified) + ". "
        "Rewrite the SAME JSON (identical shape), removing or correcting those figures so that EVERY number "
        "you state appears in the KPIs / FACTS / chart readings provided above (you may divide two given "
        "figures to state a share). Do not introduce any new numbers. Return STRICT JSON only."
    )


def generate_conclusions(facts: list[dict], domain: str = "generic", user_context: str | None = None,
                         templated_fallback: str = "", kpis: list[dict] | None = None,
                         chart_readings: list[dict] | None = None) -> dict:
    messages = _build_messages(facts, domain, user_context, kpis, chart_readings)
    ground_src = _ground_sources(facts, kpis, chart_readings)
    raw = _groq.chat(messages, temperature=0.45, max_tokens=2200)
    result = _result_from_raw(raw, ground_src)

    # Self-correction: the grounding guard used to be a SILENT telemetry flag — a hallucinated number was
    # still shown to the reader. If the model invented a figure, give it ONE cheap, low-temperature pass to
    # fix or drop it, and keep the repaired answer only if it's actually cleaner. (No key → raw is None →
    # result is None → this whole block is skipped and we fall through to the deterministic narrative.)
    if result and not result["grounding"]["grounded"]:
        unverified = result["grounding"]["unverified"]
        repaired_raw = _groq.chat(
            messages + [{"role": "assistant", "content": raw},
                        {"role": "user", "content": _repair_prompt(unverified)}],
            temperature=0.2, max_tokens=2200)
        repaired = _result_from_raw(repaired_raw, ground_src)
        if repaired and (repaired["grounding"]["grounded"]
                         or len(repaired["grounding"]["unverified"]) < len(unverified)):
            result = repaired

    if result:
        return result

    # Fallback — deterministic, zero-API. Lead with the SHORT headline fact as the bottom line and use the
    # fuller templated narrative (minus its trailing disclaimer, which the card renders separately) as the
    # summary, so the headline and summary don't read as the same sentence twice.
    headline = facts[0]["text"] if facts else "No confident findings."
    narrative = re.sub(r"\s*\(Automated analysis.*?\)\s*$", "", templated_fallback).strip()
    # The narrative leads with the same headline KPI we put in the bottom line — drop that leading copy so
    # the summary ADDS the story/risk rather than repeating the headline verbatim.
    summary = narrative
    if summary.startswith(headline):
        summary = summary[len(headline):].lstrip(" .—-").strip()
    # Always give the reader a real summary paragraph: if stripping left nothing (a sparse dataset whose
    # narrative was only the headline), stitch one from the next few facts instead.
    if not summary:
        summary = " ".join(f["text"] for f in facts[1:4]).strip() or narrative
    return {
        "provider": "none",
        "bottomLine": headline,
        "summary": summary,
        "chartInsights": [{"chart": c["title"], "insight": c["reading"]} for c in (chart_readings or [])[:4]],
        "conclusions": [f["text"] for f in facts[:4]],
        "actions": [],
        "grounding": {"grounded": True, "unverified": []},
        "disclaimer": DISCLAIMER,
    }
