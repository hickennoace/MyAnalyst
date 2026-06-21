"""Tests for the conclusions layer (fallback + grounding). Run: py apps/web/api/_test_conclude.py"""
import json
import os
import sys

# Ensure no key so we exercise the deterministic fallback deterministically.
os.environ.pop("LLM_API_KEY", None)

from _conclude import generate_conclusions, check_grounding, _result_from_raw, _ground_sources

failed = 0


def check(name, cond):
    global failed
    print(("PASS" if cond else "FAIL") + f"  {name}")
    if not cond:
        failed += 1


facts = [
    {"id": "k1", "text": "Total revenue: $51.4M", "kind": "kpi"},
    {"id": "k2", "text": "Gross margin: 20.4%", "kind": "kpi"},
    {"id": "bs", "text": '"Toyota" is the biggest Brand by revenue ($19.6M, 38%).', "kind": "bestseller"},
]

# Fallback (no key) returns a deterministic conclusion grounded in the facts.
res = generate_conclusions(facts, domain="sales-operational", templated_fallback="Revenue $51.4M; Toyota leads.")
check("fallback provider is 'none'", res["provider"] == "none")
check("fallback bottom line set", bool(res["bottomLine"]))
check("fallback conclusions echo the facts", len(res["conclusions"]) >= 2)
check("disclaimer present", "not financial" in res["disclaimer"].lower())
check("fallback is grounded", res["grounding"]["grounded"] is True)

# Grounding flags an invented figure, accepts a real one.
g_ok = check_grounding("Revenue was $51.4M and margin 20.4%.", facts)
check("grounding accepts real figures", g_ok["grounded"] is True)
g_bad = check_grounding("Revenue jumped to $999M.", facts)
check("grounding flags an invented figure", g_bad["grounded"] is False and "999" in str(g_bad["unverified"]))

# List ordinals ("1.", "2.") the model adds are formatting, not unverified figures.
g_ord = check_grounding("1. Revenue was $51.4M.\n2. Toyota leads at 38%.", facts)
check("grounding ignores list ordinals", g_ord["grounded"] is True)

# A percentage derivable as a ratio of two grounded values is accepted (19.6 ÷ 51.4 ≈ 38%).
g_ratio = check_grounding("Toyota's $19.6M is 38% of the $51.4M total.", facts)
check("grounding accepts a derived share", g_ratio["grounded"] is True)

# KPI values passed in are part of the grounding source (trend % lives in a KPI, not a fact).
kpis = [{"name": "Revenue trend", "value": "-33.8%"}, {"name": "Total revenue", "value": "$51.4M"}]
res2 = generate_conclusions(facts, domain="sales-operational", kpis=kpis,
                            templated_fallback="Revenue down 33.8%.")
g_kpi = check_grounding("Revenue fell 33.8% to $51.4M.", facts
                        + [{"text": f"{k['name']} {k['value']}"} for k in kpis])
check("grounding accepts a KPI-sourced figure", g_kpi["grounded"] is True)
check("generate_conclusions accepts kpis param", res2["provider"] == "none")

# _result_from_raw: parses a model JSON, grounds it, and now also grounds ACTION TITLES + chart insights
# (previously only conclusions/summary/detail were checked, so a fabricated figure could hide in a heading).
gs = _ground_sources(facts, None, None)
good = json.dumps({"bottomLine": "Toyota leads.", "summary": "Revenue is $51.4M.",
                   "conclusions": ["Toyota is 38% of revenue."], "chartInsights": [],
                   "actions": [{"title": "Grow Toyota", "detail": "Push the $19.6M line."}]})
r_ok = _result_from_raw(good, gs)
check("result_from_raw grounds a clean answer", bool(r_ok) and r_ok["grounding"]["grounded"] is True)

bad_title = json.dumps({"bottomLine": "ok", "summary": "ok", "conclusions": [], "chartInsights": [],
                        "actions": [{"title": "Cut the $777M tail", "detail": "do it"}]})
r_bad = _result_from_raw(bad_title, gs)
check("invented figure in an ACTION TITLE is now caught",
      bool(r_bad) and r_bad["grounding"]["grounded"] is False and "777" in str(r_bad["grounding"]["unverified"]))

check("result_from_raw returns None on junk/empty",
      _result_from_raw("not json", gs) is None and _result_from_raw(None, gs) is None)

print()
if failed:
    print(f"{failed} FAILED")
    sys.exit(1)
print("ALL PASSED")
