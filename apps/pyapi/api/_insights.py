"""Grounded facts + a templated narrative.

`build_facts` distills the computed analysis into short, numeric, plain-language statements. These are the
ONLY things the LLM may conclude from (every figure it writes must trace back to a fact), and they double
as a zero-API templated narrative when the LLM is off or rate-limited.
"""
from __future__ import annotations


def _money(x, sym="$"):
    a = abs(x)
    if a >= 1e6:
        return f"{sym}{x/1e6:.1f}M"
    if a >= 1e3:
        return f"{sym}{x/1e3:.0f}K"
    return f"{sym}{x:,.0f}"


def _pct(x):
    return f"{x*100:.0f}%"


def build_facts(spec: dict) -> list[dict]:
    facts: list[dict] = []
    cur = (spec.get("currency") or {}).get("symbol", "$")
    money_cols = {c["name"] for c in spec.get("columns", []) if c["type"] == "currency"}

    def _m(v):  # money in the dataset's detected currency
        return _money(v, cur)

    def _v(col, x):  # currency for money columns, plain number otherwise (so "Age" isn't shown as "$34")
        if col in money_cols:
            return _m(x)
        return f"{x:,.0f}" if abs(x) >= 1000 else f"{x:,.1f}"

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
                f"({_m(tr['revenue'])}, {_pct(tr['revenueShare'])}) and volume.", "bestseller")
        else:
            add("fact-bestseller", f"\"{tr['name']}\" earns the most ({_m(tr['revenue'])}, "
                f"{_pct(tr['revenueShare'])} of revenue) while \"{tu['name']}\" sells the most volume "
                f"({tu['units']:,.0f}).", "bestseller")
        pareto = bs.get("pareto")
        if pareto and pareto.get("concentrated"):
            add("fact-pareto", f"Revenue is highly concentrated: the top {pareto['top20PctCount']} "
                f"{bs['dimension']}s (the top 20%) drive {_pct(pareto['top20PctShare'])} of it, and just "
                f"{pareto['nFor80Pct']} of {pareto['items']} make up 80% — a classic Pareto distribution.",
                "concentration")

    tr = spec.get("trend")
    if tr and tr.get("yoyChangePct") is not None:
        add("fact-yoy", f"Revenue is {'up' if tr['yoyChangePct']>=0 else 'down'} "
            f"{_pct(abs(tr['yoyChangePct']))} year-over-year.", "trend", tr["yoyChangePct"])
    if tr and tr.get("significant"):
        add("fact-trend", f"{tr['metric']} is genuinely trending {tr['direction']} over time — a real pattern, "
            f"not random noise (p={tr['slopeP']:.3f}). Best month {tr['best']['label']} ({_m(tr['best']['value'])}).", "trend")
    sw = (tr or {}).get("biggestSwing")
    if sw and sw.get("notable"):
        add("fact-swing", f"The sharpest move was a {_pct(abs(sw['changePct']))} {sw['direction']} from "
            f"{sw['fromLabel']} ({_m(sw['fromValue'])}) to {sw['toLabel']} ({_m(sw['toValue'])}) — "
            f"a likely turning point worth explaining.", "trend", sw["changePct"])

    fc = spec.get("forecast")
    if fc:
        bt = fc.get("backtest")
        accuracy = (f" In backtests this model's forecasts landed within ~{_pct(bt['mape'])} of actuals."
                    if bt and bt["mape"] < 0.5 else "")
        add("fact-forecast", f"Projected revenue {'rises' if fc['changePct']>=0 else 'falls'} "
            f"{_pct(abs(fc['changePct']))} over the next {len(fc['forecast'])} months "
            f"({fc['method']}).{accuracy}", "forecast", fc["changePct"])

    st = spec.get("stats", {})
    d = st.get("drivers")
    if d and d.get("fP", 1) < 0.05 and d["drivers"]:
        lead = d["drivers"][0]
        if lead["significant"]:
            direction = "up" if lead["beta"] >= 0 else "down"
            add("fact-driver", f"{lead['name']} is the biggest factor moving {d['target']} {direction} — even "
                f"after accounting for the others — and together they explain {_pct(d['r2'])} of why it varies "
                f"(a real effect, not chance; p={lead['p']:.3f}).", "driver")

    # Group gaps — only when it's a real outcome×operational gap, not a price/product tautology. Surface up
    # to TWO so a dataset with several real gaps doesn't lose all but the strongest before the AI sees it.
    gaps = 0
    for g in st.get("groupComparisons", []):
        if g.get("significant") and not g.get("valueTautology"):
            add("fact-gap", f"{g['metric']} differs by {g['dimension']}: \"{g['top']['name']}\" "
                f"({g['top']['mean']:,.0f}) vs \"{g['bottom']['name']}\" ({g['bottom']['mean']:,.0f}); "
                f"{g['dimension']} explains {_pct(g['etaSq'])} of it.", "gap")
            gaps += 1
            if gaps >= 2:
                break

    # A relationship qualifies if it's a meaningful straight-line link OR a monotonic-but-curved one that
    # Pearson alone would under-rate (strong rank agreement, weak r). Either way it's worth a sentence.
    # Surface up to TWO real relationships so multi-metric datasets keep more than the single strongest.
    corrs = 0
    for c in st.get("correlations", []):
        if not (c.get("significant") and not c["redundant"]
                and (c["strength"] != "weak" or c.get("nonlinear"))):
            continue
        if c.get("nonlinear"):
            add("fact-corr", f"{c['a']} and {c['b']} move together but not in a straight line "
                f"(rank r={c['spearman']:.2f} vs linear r={c['r']:.2f}) — a curved relationship, likely "
                f"diminishing returns; association, not proven cause.", "correlation")
        else:
            add("fact-corr", f"{c['a']} and {c['b']} move together (r={c['r']:.2f}, {c['strength']}) — "
                f"association, not proven cause.", "correlation")
        corrs += 1
        if corrs >= 2:
            break

    # Categorical association (chi-square): two category columns that occur together more than chance. The
    # engine already computes these but they were never narrated — surface the strongest non-trivial one so
    # the AI can explain structure in survey/ops/HR data, not just numeric relationships. Skip near-perfect
    # links (cramersV≈1), which are trivial hierarchies (City~State). Plain wording, no stat to parrot.
    assoc = next((a for a in st.get("associations", [])
                  if a.get("significant") and 0.2 <= a.get("cramersV", 0) < 0.98), None)
    if assoc:
        v = assoc["cramersV"]
        strength = "strong" if v > 0.5 else "moderate" if v > 0.3 else "mild"
        add("fact-association", f"\"{assoc['a']}\" and \"{assoc['b']}\" tend to go together — certain "
            f"{assoc['a']} values commonly pair with certain {assoc['b']} values (a {strength} link, not "
            f"random). Looking at them together reveals patterns you'd miss one at a time.", "association")

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
                f"typical (median) {_v(o['column'], o['median'])} vs mean {_v(o['column'], o['mean'])} — "
                f"a {o['count']}-point tail; use the median.", "distribution")
        else:
            add("fact-anomaly", f"{o['column']} has {o['count']} isolated extreme value(s) worth checking.", "anomaly")

    # Distribution shape for a key metric — only if a skew/outlier fact didn't already cover that column.
    covered = {f["text"].split(" is ")[0].strip('"') for f in facts if f["kind"] == "distribution"}
    for d in spec.get("distributions", []):
        if not d["normal"] and abs(d["skew"]) > 0.6 and d["column"] not in covered:
            mean_s = _v(d["column"], d["mean"])
            med_s = _v(d["column"], d["median"])
            add("fact-distribution", f"{d['column']} is {d['shape']} and not normally distributed — its average "
                f"({mean_s}) is pulled by the tail, so the median ({med_s}) is the more honest 'typical' value.",
                "distribution")
            break

    # Data-quality caveat: the engine scores completeness/duplicates/constant columns but never told the AI,
    # so a confident "Total profit is $X" could be written off a half-empty column. Emit it as a FACT — which
    # is itself a grounding source — so the narrator both CAN and MUST hedge when the data isn't clean.
    q = spec.get("quality") or {}
    q_issues = q.get("issues") or []
    if q_issues and (q.get("rating") != "good" or q.get("duplicates") or q.get("completeness", 1.0) < 0.98):
        lead = "; ".join(q_issues[:2])
        rating = q.get("rating", "fair")
        # Don't label the note "(good)" while flagging a 34%-empty column — that reads as a contradiction;
        # only surface the rating word when the data is actually fair/weak.
        prefix = "Data-quality note" if rating == "good" else f"Data-quality note ({rating})"
        add("fact-quality", f"{prefix}: {lead}. Treat the affected totals as approximate and weigh the "
            f"conclusions accordingly.", "quality")

    return facts


def chart_readings(spec: dict) -> list[dict]:
    """A plain-language reading of EACH chart the engine produced, so the LLM can interpret the visuals
    (not just the raw facts). Built from the computed analysis, tied to each chart's title."""
    readings: list[dict] = []
    cur = (spec.get("currency") or {}).get("symbol", "$")
    money_cols = {c["name"] for c in spec.get("columns", []) if c["type"] == "currency"}

    def _m(v):
        return _money(v, cur)

    def _v(col, x):
        if col in money_cols:
            return _m(x)
        return f"{x:,.0f}" if abs(x) >= 1000 else f"{x:,.1f}"

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
                       + (f", peaking in {best.get('label')} at {_m(best.get('value', 0))}" if best else "")
                       + (f"; {'up' if (trend.get('yoyChangePct') or 0) >= 0 else 'down'} "
                          f"{_pct(abs(trend.get('yoyChangePct') or 0))} year-over-year" if trend.get("yoyChangePct") is not None else "")
                       + ".")
        elif c["id"] == "chart-bestsellers" and bs:
            tr = bs["topRevenue"]
            top3 = sum(p["revenueShare"] for p in bs["byRevenue"][:3])
            reading = (f"\"{tr['name']}\" is the biggest {bs['dimension']} at {_m(tr['revenue'])} "
                       f"({_pct(tr['revenueShare'])}); the top 3 make up {_pct(top3)} of revenue — "
                       f"{'concentrated' if top3 > 0.6 else 'fairly spread'}.")
        elif c["id"] == "chart-forecast" and fc:
            bt = fc.get("backtest")
            acc = (f" backtested accuracy ~{_pct(bt['mape'])} error" if bt and bt["mape"] < 0.5 else "")
            reading = (f"The {fc.get('method', 'model')} projects revenue "
                       f"{'rising' if fc['changePct'] >= 0 else 'falling'} {_pct(abs(fc['changePct']))} "
                       f"over the next {len(fc['forecast'])} months"
                       + (" (seasonal pattern carried through)" if fc.get("seasonal") else "")
                       + acc + ".")
        elif c["id"] == "chart-corr" and cors:
            strong = next((x for x in cors if not x["redundant"] and (abs(x["r"]) > 0.3 or x.get("nonlinear"))), None)
            if strong:
                curved = " (monotonic but curved — diminishing returns)" if strong.get("nonlinear") else ""
                reading = (f"Strongest relationship: {strong['a']} and {strong['b']} "
                           f"(r={strong['r']:.2f}, {strong['strength']}{'' if strong.get('significant') else ', not significant'})"
                           f"{curved}.")
            else:
                reading = "No strong correlations between the numeric metrics."
        elif c["id"] == "chart-scatter" and cors:
            s = cors[0]
            reading = f"{s['a']} vs {s['b']} scatter: r={s['r']:.2f} ({s['strength']})."
        elif c["id"] == "chart-histogram":
            name = title.replace("Distribution of ", "")
            dd = next((d for d in spec.get("distributions", []) if d["column"] == name), None)
            if dd:
                mean_s = _v(name, dd["mean"])
                med_s = _v(name, dd["median"])
                rel = "sits near" if dd["normal"] else "is pulled away from"
                norm = "" if dd["normal"] else " and not normally distributed"
                reading = f"{name} is {dd['shape']}{norm}; the mean ({mean_s}) {rel} the median ({med_s})."
        if reading:
            readings.append({"title": title, "reading": reading})
    return readings


def templated_narrative(facts: list[dict]) -> str:
    """A zero-API conclusion paragraph — the always-works fallback when Groq is off or rate-limited.

    Reads like a brief: lead with the headline number, then the strongest story (who leads / where it's
    trending), then a risk to watch (concentration / anomaly). Prioritized so the most decision-relevant
    facts come first, not just the first three computed.
    """
    if not facts:
        return "Nothing rose to a confident finding; more rows or an outcome column would help."
    by_kind: dict[str, dict] = {}
    for f in facts:
        by_kind.setdefault(f["kind"], f)
    headline = next((f for f in facts if f["kind"] == "kpi"), facts[0])
    # Strongest "what's happening" story, in priority order.
    story = next((by_kind[k] for k in ("bestseller", "trend", "driver", "gap") if k in by_kind), None)
    # A risk/quality flag to watch — a data-quality warning leads, it's the most decision-relevant caveat.
    risk = next((by_kind[k] for k in ("quality", "concentration", "anomaly", "distribution", "rfm") if k in by_kind), None)
    parts = [headline["text"]]
    for f in (story, risk):
        if f and f["text"] not in parts:
            parts.append(f["text"])
    body = " ".join(parts)
    return body + " (Automated analysis — not financial advice; verify anything important with a professional.)"
