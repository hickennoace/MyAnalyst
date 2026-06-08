"""MyAnalyst Python analysis engine (pandas/numpy/scipy).

A faithful port of the smart, business-first logic the TypeScript engine grew: metric SEMANTICS
(what a number means) → revenue-first KPIs, best-seller story, structure-aware domain detection. The
engine computes deterministic FACTS; an LLM (Groq/Gemini) turns those facts into conclusions later.

`analyze(df) -> dict` returns a JSON-serializable spec the web frontend can render.
"""
from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

import _timeseries as _ts
import _forecast as _fc
import _stats as _st
import _outliers as _ol
import _charts as _ch
import _insights as _ins
import _segments as _sg
import _rfm as _rf

# ─────────────────────────── Profiling: type + role per column ───────────────────────────

CURRENCY_HINT = re.compile(r"(price|cost|revenue|sales|amount|amt|total|spend|profit|fee|salary|wage|usd|eur|gbp|paid|charge|value)", re.I)
ID_HINT = re.compile(r"(\bid\b|_id\b|uuid|guid|code|sku|ticket|order[_\s-]?no|number|account)", re.I)


def _is_datelike(s: pd.Series) -> bool:
    if pd.api.types.is_datetime64_any_dtype(s):
        return True
    sample = s.dropna().astype(str).head(50)
    if sample.empty:
        return False
    parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
    return parsed.notna().mean() > 0.8


def profile(df: pd.DataFrame) -> list[dict[str, Any]]:
    n = len(df)
    profiles: list[dict[str, Any]] = []
    for col in df.columns:
        s = df[col]
        non_null = s.dropna()
        distinct = int(non_null.nunique())
        fill = float(len(non_null) / n) if n else 0.0
        card_ratio = distinct / n if n else 0.0
        numeric = pd.to_numeric(s, errors="coerce")
        num_frac = float(numeric.notna().mean())
        is_num = num_frac > 0.8 and not _is_datelike(s)
        is_date = _is_datelike(s)

        if is_date:
            ctype, role = "date", "time"
        elif is_num:
            ctype = "currency" if CURRENCY_HINT.search(str(col)) else ("integer" if numeric.dropna().mod(1).eq(0).all() else "number")
            # An id-like numeric (high cardinality, id name) is an identifier, not a metric.
            role = "identifier" if (ID_HINT.search(str(col)) and card_ratio > 0.5) else "metric"
        else:
            ctype = "category"
            role = "identifier" if (ID_HINT.search(str(col)) or card_ratio > 0.9) else "dimension"

        p: dict[str, Any] = {
            "name": str(col), "type": ctype, "role": role,
            "distinct": distinct, "fill": fill, "cardinalityRatio": card_ratio,
        }
        if is_num:
            v = numeric.dropna()
            if len(v):
                p["numeric"] = {
                    "sum": float(v.sum()), "mean": float(v.mean()), "median": float(v.median()),
                    "std": float(v.std(ddof=1)) if len(v) > 1 else 0.0,
                    "min": float(v.min()), "max": float(v.max()),
                }
        profiles.append(p)
    return profiles


# ─────────────────────────── Semantics: what each number MEANS ───────────────────────────

REVENUE_NAME = re.compile(r"\b(revenue|sales?|turnover|gmv|income|proceeds|amount|amt|bookings?|net[_\s-]?sales|gross[_\s-]?sales|grand[_\s-]?total)\b", re.I)
QTY_NAME = re.compile(r"\b(qty|quantity|units?|orders?|count|volume|sold|pieces?|items?|tickets?|seats?|bookings?)\b", re.I)
ATTRIBUTE_NAME = re.compile(r"(%|percent|\brate\b|ratio|\bavg\b|average|\bmean\b|median|margin|\bscore\b|rating|\bindex\b|\bage\b|\byear\b|\bid\b|\bno\.?\b|\bnumber\b|\bcode\b|\bzip\b|postal|phone|\blat(itude)?\b|\blon(gitude)?\b|\blng\b|tenure|\bdays?\b|temperature|\btemp\b|weight|height|\bbmi\b|distance|duration|\bgpa\b)", re.I)
UNIT_PRICE_NAME = re.compile(r"\b(price|unit[_\s-]?price|msrp|list[_\s-]?price|fee|wage|salary|hourly|per[_\s-]?unit|rate)\b", re.I)
COST_NAME = re.compile(r"\b(cogs|cost|costs|cost[_\s-]?of[_\s-]?goods)\b", re.I)


def _metrics(profiles):
    return [p for p in profiles if p["role"] == "metric" and "numeric" in p]


def is_transaction_grain(profiles, n) -> bool:
    if n < 12:
        return False
    has_time = any(p["role"] == "time" for p in profiles)
    repeating = any(
        p["role"] in ("dimension", "identifier") and 2 <= p["distinct"] <= max(2, n * 0.7)
        for p in profiles
    )
    return has_time and repeating


def revenue_metric(profiles, grain, domain=None):
    if domain == "financial-timeseries":
        return None
    metrics = _metrics(profiles)
    named = [m for m in metrics if REVENUE_NAME.search(m["name"]) and not ATTRIBUTE_NAME.search(m["name"]) and not QTY_NAME.search(m["name"])]
    if named:
        return max(named, key=lambda m: m["numeric"]["sum"])
    if grain:
        price_like = [m for m in metrics if (m["type"] == "currency" or UNIT_PRICE_NAME.search(m["name"])) and not ATTRIBUTE_NAME.search(m["name"])]
        if price_like:
            return max(price_like, key=lambda m: m["numeric"]["sum"])
    return None


def quantity_metric(profiles, revenue):
    qty = [m for m in _metrics(profiles) if (revenue is None or m["name"] != revenue["name"]) and QTY_NAME.search(m["name"]) and not ATTRIBUTE_NAME.search(m["name"])]
    return max(qty, key=lambda m: m["numeric"]["sum"]) if qty else None


def is_additive(p, revenue) -> bool:
    if revenue and p["name"] == revenue["name"]:
        return True
    if QTY_NAME.search(p["name"]) and not ATTRIBUTE_NAME.search(p["name"]):
        return True
    if REVENUE_NAME.search(p["name"]) and not ATTRIBUTE_NAME.search(p["name"]) and not UNIT_PRICE_NAME.search(p["name"]):
        return True
    return False


def is_rate_like(name) -> bool:
    return bool(re.search(r"(\brate\b|ratio|\bscore\b|rating|csat|\bnps\b|satisfaction|margin|percent|%|conversion|\bctr\b|\broi\b|\baov\b|utilization|occupancy|accuracy|efficiency)", name, re.I))


# ─────────────────────────── Domain (structure-aware) ───────────────────────────

STRONG_FIN = re.compile(r"(\bclose\b|\bopen\b|\bhigh\b|\blow\b|ohlc|ticker|portfolio|\bnav\b|\byield\b|dividend|\bequity\b|candlestick|drawdown|coupon|maturity|cusip|isin|sharpe)", re.I)
WEAK_FIN = re.compile(r"(\bprice\b|\bvolume\b|\breturn\b|\bbalance\b|\basset\b|\binterest\b)", re.I)
SALES_KW = re.compile(r"(sales|revenue|orders?|quantity|\bqty\b|\bunits?\b|product|customer|client|invoice|profit|margin|\bsku\b|region|stores?|\bprice\b|\bcost\b|discount|brand|model|make|dealer|vendor|supplier|category|shipment|warehouse|inventory|payment|transaction|deal)", re.I)
MKT_KW = re.compile(r"(impression|click|\bctr\b|conversion|campaign|channel|spend|\bcpc\b|\bcpm\b|roas|\blead\b|session|bounce|audience|\breach\b|engagement)", re.I)
SURVEY_KW = re.compile(r"(rating|\bscore\b|response|question|satisfaction|\bnps\b|agree|likert|respondent|feedback|survey)", re.I)


def detect_domain(profiles, n) -> dict[str, Any]:
    names = [p["name"] for p in profiles]
    grain = is_transaction_grain(profiles, n)
    has_time = any(p["role"] == "time" for p in profiles)

    def cnt(rx):
        return sum(1 for nm in names if rx.search(nm))

    strong, weak = cnt(STRONG_FIN), cnt(WEAK_FIN)
    fin = strong * 2 + (0 if grain else weak + (1 if (has_time and strong + weak > 0) else 0))
    sales = cnt(SALES_KW) + (1 if grain else 0)
    scores = [
        ("sales-operational", sales, "sales/order/product columns"),
        ("financial-timeseries", fin, "price/return/volume columns over time"),
        ("marketing", cnt(MKT_KW), "campaign/click/conversion columns"),
        ("survey", cnt(SURVEY_KW), "survey/rating/response columns"),
    ]
    scores.sort(key=lambda x: x[1], reverse=True)
    top = scores[0]
    if top[1] > 0:
        return {"domain": top[0], "confidence": min(0.95, 0.4 + top[1] * 0.16), "reason": f"Detected {top[2]}."}
    return {"domain": "generic", "confidence": 0.4, "reason": "No strong domain keywords."}


# ─────────────────────────── Helpers ───────────────────────────

def _fmt_money(x):
    a = abs(x)
    if a >= 1e6:
        return f"${x/1e6:.1f}M"
    if a >= 1e3:
        return f"${x/1e3:.0f}K"
    return f"${x:,.0f}"


def _fmt_num(x):
    return f"{x:,.0f}" if abs(x) >= 1000 else f"{x:,.2f}"


def _time_col(profiles):
    return next((p for p in profiles if p["role"] == "time"), None)


def _monthly_revenue(df, time_name, rev_name):
    """Total revenue summed per month, chronologically. Returns (labels, values)."""
    t = pd.to_datetime(df[time_name], errors="coerce", format="mixed")
    v = pd.to_numeric(df[rev_name], errors="coerce")
    g = pd.DataFrame({"m": t.dt.to_period("M"), "v": v}).dropna()
    if g.empty:
        return [], []
    agg = g.groupby("m")["v"].sum().sort_index()
    return [str(p) for p in agg.index], agg.to_numpy()


def _trim_partial_tail(values: np.ndarray) -> np.ndarray:
    if len(values) < 4:
        return values
    prior = values[:-1]
    med = np.median(prior)
    return prior if (med > 0 and values[-1] < 0.5 * med) else values


# ─────────────────────────── Best sellers ───────────────────────────

def _gini(x: np.ndarray) -> float:
    x = np.sort(x[np.isfinite(x) & (x >= 0)])
    n = len(x)
    if n == 0 or x.sum() == 0:
        return 0.0
    idx = np.arange(1, n + 1)
    return float((np.sum((2 * idx - n - 1) * x)) / (n * x.sum()))


def best_sellers(df, profiles, revenue, qty):
    if revenue is None:
        return None
    n = len(df)
    dims = [
        p for p in profiles
        if p["role"] in ("dimension", "identifier") and p["type"] != "date"
        and p["name"] not in (revenue["name"], qty["name"] if qty else None)
        and 2 <= p["distinct"] <= min(60, max(2, n * 0.5))
        and (p["role"] == "identifier" or p["cardinalityRatio"] <= 0.6)
    ]
    if not dims:
        return None
    rev = pd.to_numeric(df[revenue["name"]], errors="coerce").fillna(0).clip(lower=0)
    units = pd.to_numeric(df[qty["name"]], errors="coerce").fillna(0) if qty else pd.Series(np.ones(n), index=df.index)

    best = None
    for d in dims:
        grp = pd.DataFrame({"k": df[d["name"]].astype("string"), "rev": rev, "u": units}).dropna(subset=["k"])
        agg = grp.groupby("k").agg(rev=("rev", "sum"), u=("u", "sum"))
        if len(agg) < 2 or agg["rev"].sum() <= 0:
            continue
        g = _gini(agg["rev"].to_numpy())
        if best is None or g > best[2]:
            best = (d, agg, g)
    if best is None:
        return None
    d, agg, _ = best
    total_rev = float(agg["rev"].sum())
    total_u = float(agg["u"].sum()) or 1.0
    by_rev = agg.sort_values("rev", ascending=False)
    by_u = agg.sort_values("u", ascending=False)

    def perf(name, row):
        return {"name": name, "revenue": float(row["rev"]), "revenueShare": float(row["rev"] / total_rev),
                "units": float(row["u"]), "unitShare": float(row["u"] / total_u)}

    return {
        "dimension": d["name"], "metric": revenue["name"], "distinct": int(len(agg)),
        "totalRevenue": total_rev, "totalUnits": total_u, "hasQuantity": qty is not None,
        "byRevenue": [perf(i, r) for i, r in by_rev.head(6).iterrows()],
        "byUnits": [perf(i, r) for i, r in by_u.head(6).iterrows()],
        "topRevenue": perf(by_rev.index[0], by_rev.iloc[0]),
        "topUnits": perf(by_u.index[0], by_u.iloc[0]),
    }


# ─────────────────────────── KPIs ───────────────────────────

def _total_label(name):
    if re.search(r"revenue|sales|turnover|gmv|income|amount|spend|cost|profit|bookings?", name, re.I):
        return name if re.match(r"^total\b", name, re.I) else f"Total {name}"
    return "Total revenue"


def compute_kpis(df, profiles, domain, bestsellers) -> list[dict[str, Any]]:
    n = len(df)
    kpis: list[dict[str, Any]] = []
    grain = is_transaction_grain(profiles, n)
    revenue = revenue_metric(profiles, grain, domain)
    qty = quantity_metric(profiles, revenue)
    time_col = _time_col(profiles)

    if revenue:
        num = revenue["numeric"]
        money = revenue["type"] == "currency"
        fmt = _fmt_money if money else _fmt_num
        kpis.append({"id": f"kpi-total-{revenue['name']}", "name": _total_label(revenue["name"]),
                     "value": fmt(num["sum"]), "relevance": 1.0,
                     "howComputed": f"Sum of {revenue['name']} across all {n:,} rows."})
        if qty:
            kpis.append({"id": f"kpi-total-{qty['name']}", "name": f"Total {qty['name']}",
                         "value": f"{qty['numeric']['sum']:,.0f}", "relevance": 0.95,
                         "howComputed": f"Sum of {qty['name']}."})
        else:
            kpis.append({"id": "kpi-volume", "name": "Transactions" if grain else "Records",
                         "value": f"{n:,}", "relevance": 0.95,
                         "howComputed": "One row per transaction." if grain else "Rows ingested."})
        kpis.append({"id": f"kpi-avg-{revenue['name']}", "name": f"Average {revenue['name']}",
                     "value": fmt(num["mean"]), "relevance": 0.8,
                     "howComputed": f"Mean {revenue['name']} per row (median {fmt(num['median'])})."})

        # Revenue trend (monthly, partial final month trimmed)
        monthly_best = None
        if time_col:
            labels, vals = _monthly_revenue(df, time_col["name"], revenue["name"])
            series = _trim_partial_tail(vals)
            if len(series) >= 2:
                yoy = len(series) > 12
                base = series[-13] if yoy else series[0]
                if base != 0:
                    chg = (series[-1] - base) / abs(base)
                    kpis.append({"id": "kpi-revtrend", "name": f"{_total_label(revenue['name'])} {'(YoY)' if yoy else 'trend'}",
                                 "value": f"{chg*100:.1f}%", "trend": float(chg), "relevance": 0.9,
                                 "howComputed": f"Change in total {revenue['name']} per month {'vs a year earlier' if yoy else 'first→latest complete month'}."})
            if len(vals):
                bi = int(np.argmax(vals))
                monthly_best = (labels[bi], float(vals[bi]))

        # Gross margin
        cost = next((p for p in _metrics(profiles) if p["name"] != revenue["name"] and COST_NAME.search(p["name"]) and p["numeric"]["sum"] > 0), None)
        if cost and num["sum"] > 0:
            margin = (num["sum"] - cost["numeric"]["sum"]) / num["sum"]
            kpis.append({"id": "kpi-margin", "name": "Gross margin", "value": f"{margin*100:.1f}%",
                         "trend": float(margin), "relevance": 0.92,
                         "howComputed": f"(total {revenue['name']} − total {cost['name']}) ÷ total {revenue['name']}."})

        # Top performer
        if bestsellers and bestsellers["topRevenue"]["revenueShare"] >= 0.15:
            t = bestsellers["topRevenue"]
            kpis.append({"id": "kpi-topseller", "name": f"Top {bestsellers['dimension']}",
                         "value": f"{t['name']} · {round(t['revenueShare']*100)}%", "relevance": 0.86,
                         "howComputed": f"\"{t['name']}\" share of total {bestsellers['metric']}."})
        # Best month
        if monthly_best:
            kpis.append({"id": "kpi-bestmonth", "name": "Best month",
                         "value": f"{monthly_best[0]} · {fmt(monthly_best[1])}", "relevance": 0.6,
                         "howComputed": f"Month with the highest total {revenue['name']}."})
    else:
        kpis.append({"id": "kpi-rows", "name": "Records analyzed", "value": f"{n:,}", "relevance": 0.4,
                     "howComputed": "Rows ingested."})

    # Per-metric: sum flows; average only meaningful attributes (drop bare age-type averages).
    for m in _metrics(profiles):
        if revenue and m["name"] == revenue["name"]:
            continue
        if qty and m["name"] == qty["name"]:
            continue
        num = m["numeric"]
        money = m["type"] == "currency"
        fmt = _fmt_money if money else _fmt_num
        if is_additive(m, revenue):
            kpis.append({"id": f"kpi-total-{m['name']}", "name": m["name"] if re.match(r"^total\b", m["name"], re.I) else f"Total {m['name']}",
                         "value": fmt(num["sum"]), "relevance": 0.7 if money else 0.55,
                         "howComputed": f"Sum of all {m['name']} values."})
        elif is_rate_like(m["name"]) or not revenue:
            kpis.append({"id": f"kpi-avg-{m['name']}", "name": f"Average {m['name']}",
                         "value": fmt(num["mean"]), "relevance": 0.62 if is_rate_like(m["name"]) else 0.4,
                         "howComputed": f"Mean of {m['name']} (median {fmt(num['median'])})."})

    kpis.sort(key=lambda k: k["relevance"], reverse=True)
    return kpis


# ─────────────────────────── Orchestrator ───────────────────────────

def analyze(df: pd.DataFrame) -> dict[str, Any]:
    df = df.dropna(axis=1, how="all").copy()
    n = len(df)
    profiles = profile(df)
    domain = detect_domain(profiles, n)
    grain = is_transaction_grain(profiles, n)
    revenue = revenue_metric(profiles, grain, domain["domain"])
    qty = quantity_metric(profiles, revenue)
    bs = best_sellers(df, profiles, revenue, qty)
    kpis = compute_kpis(df, profiles, domain["domain"], bs)

    metric_names = [m["name"] for m in _metrics(profiles)]
    time_col = _time_col(profiles)

    # Time series + Holt-Winters forecast on revenue summed per month.
    monthly = None
    trend = None
    forecast = None
    if revenue and time_col:
        labels, values = _ts.monthly_sum(df, time_col["name"], revenue["name"])
        if len(values):
            monthly = (labels, values)
            series = _ts.trim_partial_tail(values)
            trend = _ts.trend_analysis(labels[: len(series)], series, f"monthly {revenue['name'].lower()}")
            if trend is not None:
                trend["seasonalityStrength"] = _ts.seasonality_strength(series, 12)
            period = 12 if len(series) >= 24 else None
            forecast = _fc.forecast_series(series, _fc.default_horizon(len(series)), period)

    # Rigorous inference (scipy + statsmodels).
    stats_block: dict[str, Any] = {}
    if len(metric_names) >= 2:
        stats_block["correlations"] = _st.correlations(df, metric_names)
    if len(metric_names) >= 3:
        target = revenue["name"] if revenue else metric_names[0]
        drivers = _st.driver_analysis(df, metric_names, target)
        if drivers:
            stats_block["drivers"] = drivers
    stats_block["groupComparisons"] = _st.group_comparisons(df, profiles, metric_names)
    stats_block["associations"] = _st.associations(df, profiles)

    # Outliers — skewed segment vs isolated anomaly.
    outliers = []
    for m in _metrics(profiles):
        o = _ol.analyze_column_outliers(m["name"], pd.to_numeric(df[m["name"]], errors="coerce"))
        if o:
            outliers.append(o)
    outliers.sort(key=lambda x: x["count"], reverse=True)

    segments = _sg.segment_rows(df, profiles)
    rfm = _rf.analyze_rfm(df, profiles)

    spec: dict[str, Any] = {
        "engine": "python",
        "rowCount": n,
        "domain": domain,
        "columns": [{"name": p["name"], "type": p["type"], "role": p["role"]} for p in profiles],
        "kpis": kpis,
        "bestSellers": bs,
        "trend": trend,
        "forecast": forecast,
        "stats": stats_block,
        "outliers": outliers[:5],
        "segments": segments,
        "rfm": rfm,
    }
    spec["charts"] = _ch.build_charts(df, profiles, {
        "revenue": revenue, "bestsellers": bs, "monthly": monthly, "forecast": forecast,
        "correlations": stats_block.get("correlations", []), "metric_names": metric_names,
    })
    spec["facts"] = _ins.build_facts(spec)
    spec["chartReadings"] = _ins.chart_readings(spec)
    spec["narrative"] = _ins.templated_narrative(spec["facts"])
    return spec
