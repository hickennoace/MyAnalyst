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

    rfm = spec.get("rfm")
    if rfm and rfm.get("segments"):
        champ = next((s for s in rfm["segments"] if s["key"] == "champions"), None)
        risk = next((s for s in rfm["segments"] if s["key"] == "at-risk"), None)
        bits = []
        if champ:
            bits.append(f"{champ['size']} Champions ({_pct(champ['monetaryShare'])} of revenue)")
        if risk:
            bits.append(f"{risk['size']} At-Risk")
        if bits:
            add("fact-rfm", f"Of {rfm['customers']} {rfm['entity']}s: {', '.join(bits)} — "
                f"reward the Champions and win back the At-Risk.", "rfm")

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

    # Distribution shape for a key metric — only if a skew/outlier fact didn't already cover that column.
    covered = {f["text"].split(" is ")[0].strip('"') for f in facts if f["kind"] == "distribution"}
    for d in spec.get("distributions", []):
        if not d["normal"] and abs(d["skew"]) > 0.6 and d["column"] not in covered:
            mean_s = _money(d["mean"]) if abs(d["mean"]) > 100 else f"{d['mean']:.1f}"
            med_s = _money(d["median"]) if abs(d["median"]) > 100 else f"{d['median']:.1f}"
            add("fact-distribution", f"{d['column']} is {d['shape']} and not normally distributed — its average "
                f"({mean_s}) is pulled by the tail, so the median ({med_s}) is the more honest 'typical' value.",
                "distribution")
            break

    return facts


def chart_readings(spec: dict) -> list[dict]:
    """A plain-language reading of EACH chart the engine produced, so the LLM can interpret the visuals
    (not just the raw facts). Built from the computed analysis, tied to each chart's title."""
    readings: list[dict] = []
    trend = spec.get("trend") or {}
    bs = spec.get("bestSellers") or {}
    fc = spec.get("forecast") or {}
    cors = (spec.get("stats") or {}).get("correlations", [])

    for c in spec.get("charts", []):
        title = c["title"]
        reading = None
        if c["id"] == "chart-timeseries" and trend:
            best = trend.get("best", {})
            direction = trend.get("direction", "flat")
            reading = (f"Revenue trends {direction} over the period"
                       + (f", peaking in {best.get('label')} at {_money(best.get('value', 0))}" if best else "")
                       + (f"; {'up' if (trend.get('yoyChangePct') or 0) >= 0 else 'down'} "
                          f"{_pct(abs(trend.get('yoyChangePct') or 0))} year-over-year" if trend.get("yoyChangePct") is not None else "")
                       + ".")
        elif c["id"] == "chart-bestsellers" and bs:
            tr = bs["topRevenue"]
            top3 = sum(p["revenueShare"] for p in bs["byRevenue"][:3])
            reading = (f"\"{tr['name']}\" is the biggest {bs['dimension']} at {_money(tr['revenue'])} "
                       f"({_pct(tr['revenueShare'])}); the top 3 make up {_pct(top3)} of revenue — "
                       f"{'concentrated' if top3 > 0.6 else 'fairly spread'}.")
        elif c["id"] == "chart-forecast" and fc:
            reading = (f"The {fc.get('method', 'model')} projects revenue "
                       f"{'rising' if fc['changePct'] >= 0 else 'falling'} {_pct(abs(fc['changePct']))} "
                       f"over the next {len(fc['forecast'])} months"
                       + (" (seasonal pattern carried through)" if fc.get("seasonal") else "") + ".")
        elif c["id"] == "chart-corr" and cors:
            strong = next((x for x in cors if not x["redundant"] and abs(x["r"]) > 0.3), None)
            if strong:
                reading = (f"Strongest relationship: {strong['a']} and {strong['b']} "
                           f"(r={strong['r']:.2f}, {strong['strength']}{'' if strong.get('significant') else ', not significant'}).")
            else:
                reading = "No strong correlations between the numeric metrics."
        elif c["id"] == "chart-scatter" and cors:
            s = cors[0]
            reading = f"{s['a']} vs {s['b']} scatter: r={s['r']:.2f} ({s['strength']})."
        if reading:
            readings.append({"title": title, "reading": reading})
    return readings


def templated_narrative(facts: list[dict]) -> str:
    """A zero-API conclusion paragraph from the facts — the always-works fallback."""
    if not facts:
        return "Nothing rose to a confident finding; more rows or an outcome column would help."
    lead = [f for f in facts if f["kind"] in ("bestseller", "trend", "driver", "gap")][:3]
    body = " ".join(f["text"] for f in lead) if lead else facts[0]["text"]
    return body + " (Automated analysis — not financial advice; verify anything important with a professional.)"
