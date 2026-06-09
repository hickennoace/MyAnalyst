"""Chart builders — return DATA (title, type, x, series); the frontend turns these into ECharts options.

Mirrors the TS chart set but with the fixed, business-first lens: revenue/volume by product (not average
price), monthly revenue over time, a monthly-revenue forecast with a band, plus correlation heatmap/scatter.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def _num(df, name):
    return pd.to_numeric(df[name], errors="coerce")


def _compact(x: float) -> str:
    a = abs(x)
    if a >= 1e6:
        return f"{x/1e6:.1f}M"
    if a >= 1e3:
        return f"{x/1e3:.0f}K"
    return f"{x:.0f}" if a >= 10 else f"{x:.1f}"


def _histogram(df, name, bins: int = 12) -> dict | None:
    """A distribution histogram for one metric, as a bar chart with bin-range labels — so the user SEES
    the skew/spread the stats describe (the mean-vs-median story made visual)."""
    v = _num(df, name).dropna().to_numpy()
    v = v[np.isfinite(v)]
    if len(v) < 20 or v.min() == v.max():
        return None
    counts, edges = np.histogram(v, bins=bins)
    labels = [f"{_compact(edges[i])}–{_compact(edges[i + 1])}" for i in range(len(counts))]
    return {
        "id": "chart-histogram", "type": "bar", "title": f"Distribution of {name}",
        "subtitle": "how the values are spread",
        "x": labels, "series": [{"name": "count", "values": [int(c) for c in counts]}],
    }


def build_charts(df, profiles, ctx) -> list[dict]:
    """ctx carries the already-computed pieces: revenue, bestsellers, monthly (labels/values),
    forecast, correlations, metric_names, time_col."""
    charts: list[dict] = []
    revenue = ctx.get("revenue")
    monthly = ctx.get("monthly")  # (labels, values)

    # 1. Monthly revenue over time.
    if revenue and monthly and len(monthly[0]) >= 3:
        labels, values = monthly
        charts.append({
            "id": "chart-timeseries", "type": "line", "title": "Monthly revenue over time",
            "x": labels, "series": [{"name": "revenue", "values": [float(v) for v in values]}],
        })

    # 2. Revenue (and units) by the product dimension.
    bs = ctx.get("bestsellers")
    if bs:
        rows = bs["byRevenue"]
        series = [{"name": "revenue", "values": [round(p["revenue"], 2) for p in rows]}]
        if bs["hasQuantity"]:
            series.append({"name": "units", "values": [round(p["units"], 2) for p in rows]})
        charts.append({
            "id": "chart-bestsellers", "type": "bar", "title": f"Revenue by {bs['dimension']}",
            "x": [p["name"] for p in rows], "series": series,
        })

    # 2b. Distribution histogram of the key metric (revenue if present, else the first metric).
    hist_metric = (revenue or {}).get("name") or (ctx.get("metric_names") or [None])[0]
    if hist_metric:
        hist = _histogram(df, hist_metric)
        if hist:
            charts.append(hist)

    # 3. Monthly revenue forecast (history + projection + 95% band).
    fc = ctx.get("forecast")
    if fc and monthly and len(monthly[1]):
        labels, values = monthly
        hist = [float(v) for v in values]
        h = len(fc["forecast"])
        x = labels + [f"+{i+1}" for i in range(h)]
        charts.append({
            "id": "chart-forecast", "type": "line",
            "title": f"Monthly revenue forecast (+{h})",
            "subtitle": fc.get("method"),
            "x": x,
            "series": [
                {"name": "actual", "values": hist + [None] * h},
                {"name": "forecast", "values": [None] * (len(hist) - 1) + [hist[-1]] + fc["forecast"]},
                {"name": "lower", "values": [None] * len(hist) + fc["lower"]},
                {"name": "upper", "values": [None] * len(hist) + fc["upper"]},
            ],
        })

    # 4. Correlation heatmap (numeric metrics).
    metrics = ctx.get("metric_names", [])
    if len(metrics) >= 3:
        data = pd.DataFrame({m: _num(df, m) for m in metrics})
        corr = data.corr().round(3)
        charts.append({
            "id": "chart-corr", "type": "heatmap", "title": "Correlation matrix",
            "x": list(corr.columns),
            "matrix": [[None if pd.isna(v) else float(v) for v in row] for row in corr.to_numpy()],
        })

    # 5. Scatter of the strongest correlated pair.
    cors = ctx.get("correlations", [])
    strong = next((c for c in cors if abs(c["r"]) > 0.3 and not c["redundant"]), None)
    if strong:
        s = pd.DataFrame({"x": _num(df, strong["a"]), "y": _num(df, strong["b"])}).dropna()
        charts.append({
            "id": "chart-scatter", "type": "scatter",
            "title": f"{strong['a']} vs {strong['b']}", "subtitle": f"r = {strong['r']:.2f}",
            "points": [[float(a), float(b)] for a, b in zip(s["x"], s["y"])][:2000],
        })

    return charts
