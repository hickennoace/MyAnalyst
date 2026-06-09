"""Tests for the conclusions layer (fallback + grounding). Run: py apps/web/api/_test_conclude.py"""
import os
import sys

# Ensure no key so we exercise the deterministic fallback deterministically.
os.environ.pop("LLM_API_KEY", None)

from _conclude import generate_conclusions, check_grounding

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

print()
if failed:
    print(f"{failed} FAILED")
    sys.exit(1)
print("ALL PASSED")
