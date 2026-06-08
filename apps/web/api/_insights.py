"""Grounded facts + a templated narrative.

`build_facts` distills the computed analysis into short, numeric, plain-language statements. These are the
ONLY things the LLM may conclude from (every figure it writes must trace back to a fact), and they double
as a zero-API templated narrative when the LLM is off or rate-limited.
"""
from __future__ import annotations


def _money(x):
    a = abs(x)
    if a >= 1e6:
        return f"${x/1e6:.1f}M"
    if a >= 1e3:
        return f"${x/1e3:.0f}K"
    return f"${x:,.0f}"


def _pct(x):
    return f"{x*100:.0f}%"


def build_facts(spec: dict) -> list[dict]:
    facts: list[dict] = []

    def add(fid, text, kind="metric", value=None):
        facts.append({"id": fid, "text": text, "kind": kind, "value": value})

    # Headline KPIs (the conclusion-driving ones).
    for k in spec["kpis"][:7]:
        add(k["id"], f"{k['name']}: {k['value']}", "kpi", k["value"])

    bs = spec.get("bestSellers")
    if bs:
        tr, tu = bs["topRevenue"], bs["topUnits"]
        if tr["name"] == tu["name"]:
            add("fact-bestseller", f"\"{tr['name']}\" is the biggest {bs['dimension']} by both revenue "
                f"({_money(tr['revenue'])}, {_pct(tr['revenueShare'])}) and volume.", "bestseller")
        else:
            add("fact-bestseller", f"\"{tr['name']}\" earns the most ({_money(tr['revenue'])}, "
                f"{_pct(tr['revenueShare'])} of revenue) while \"{tu['name']}\" sells the most volume "
                f"({tu['units']:,.0f}).", "bestseller")

    tr = spec.get("trend")
    if tr and tr.get("yoyChangePct") is not None:
        add("fact-yoy", f"Revenue is {'up' if tr['yoyChangePct']>=0 else 'down'} "
            f"{_pct(abs(tr['yoyChangePct']))} year-over-year.", "trend", tr["yoyChangePct"])
    if tr and tr.get("significant"):
        add("fact-trend", f"{tr['metric']} has a statistically real {tr['direction']}ward trend "
            f"(p={tr['slopeP']:.3f}). Best month {tr['best']['label']} ({_money(tr['best']['value'])}).", "trend")

    fc = spec.get("forecast")
    if fc:
        add("fact-forecast", f"Projected revenue {'rises' if fc['changePct']>=0 else 'falls'} "
            f"{_pct(abs(fc['changePct']))} over the next {len(fc['forecast'])} months "
            f"({fc['method']}).", "forecast", fc["changePct"])

    st = spec.get("stats", {})
    d = st.get("drivers")
    if d and d.get("fP", 1) < 0.05 and d["drivers"]:
        lead = d["drivers"][0]
        if lead["significant"]:
            add("fact-driver", f"{lead['name']} is the strongest independent driver of {d['target']} "
                f"(β={lead['beta']:.2f}, p={lead['p']:.3f}); the model explains {_pct(d['r2'])} of it.", "driver")

    # Group gaps — only when it's a real outcome×operational gap, not a price/product tautology.
    for g in st.get("groupComparisons", []):
        if g.get("significant") and not g.get("valueTautology"):
            add("fact-gap", f"{g['metric']} differs by {g['dimension']}: \"{g['top']['name']}\" "
                f"({g['top']['mean']:,.0f}) vs \"{g['bottom']['name']}\" ({g['bottom']['mean']:,.0f}); "
                f"{g['dimension']} explains {_pct(g['etaSq'])} of it.", "gap")
            break

    c = next((x for x in st.get("correlations", []) if x.get("significant") and x["strength"] != "weak" and not x["redundant"]), None)
    if c:
        add("fact-corr", f"{c['a']} and {c['b']} move together (r={c['r']:.2f}, {c['strength']}) — "
            f"association, not proven cause.", "correlation")

    seg = spec.get("segments")
    if seg and len(seg.get("segments", [])) > 1:
        biggest = seg["segments"][0]
        add("fact-segments", f"The data splits into {seg['k']} natural groups (clustered on "
            f"{', '.join(seg['features'])}); the largest is \"{biggest['label']}\" "
            f"({biggest['sharePct']:.0f}% of rows).", "segments")

    o = next((x for x in spec.get("outliers", []) if x), None)
    if o:
        if o["kind"] == "skew":
            add("fact-skew", f"{o['column']} is {'right' if o['direction']!='low' else 'left'}-skewed: "
                f"typical (median) {_money(o['median'])} vs mean {_money(o['mean'])} — a {o['count']}-point "
                f"tail; use the median.", "distribution")
        else:
            add("fact-anomaly", f"{o['column']} has {o['count']} isolated extreme value(s) worth checking.", "anomaly")

    return facts


def templated_narrative(facts: list[dict]) -> str:
    """A zero-API conclusion paragraph from the facts — the always-works fallback."""
    if not facts:
        return "Nothing rose to a confident finding; more rows or an outcome column would help."
    lead = [f for f in facts if f["kind"] in ("bestseller", "trend", "driver", "gap")][:3]
    body = " ".join(f["text"] for f in lead) if lead else facts[0]["text"]
    return body + " (Automated analysis — not financial advice; verify anything important with a professional.)"
