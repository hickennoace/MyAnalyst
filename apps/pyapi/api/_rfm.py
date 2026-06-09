"""RFM customer segmentation (pandas).

Score every entity (customer) on Recency, Frequency, Monetary into 1-5 quintiles, then bucket into
recognizable segments (Champions, Loyal, At Risk, …). Fires on transaction-shaped data with an entity id,
a date, and a value column. Pure.
"""
from __future__ import annotations

import re

import numpy as np
import pandas as pd

MIN_CUSTOMERS = 8

# Ordered, mutually-exclusive rules (first match wins); r/f are 1-5 quintile scores.
SEGMENTS = [
    ("champions", "Champions", lambda r, f: r >= 4 and f >= 4),
    ("loyal", "Loyal", lambda r, f: f >= 4 and r >= 2),
    ("potential", "Potential / New", lambda r, f: r >= 4 and f < 4),
    ("at-risk", "At Risk", lambda r, f: r <= 2 and f >= 3),
    ("hibernating", "Hibernating / Lost", lambda r, f: r <= 2 and f < 3),
    ("attention", "Needs Attention", lambda r, f: True),
]

_ENTITY_HINT = re.compile(r"(customer|client|user|account|member|player|buyer|email|cust|patient|subscriber)", re.I)


def _quintile(values: np.ndarray, higher_is_better: bool) -> np.ndarray:
    n = len(values)
    order = np.argsort(values, kind="stable")
    ranks = np.empty(n)
    ranks[order] = np.arange(n)
    score = np.minimum(5, (ranks / n * 5).astype(int) + 1)
    return score if higher_is_better else 6 - score


def _pick(df, profiles):
    entity = next((p for p in profiles if p["role"] == "identifier" and MIN_CUSTOMERS <= p["distinct"] < len(df)), None) \
        or next((p for p in profiles if _ENTITY_HINT.search(p["name"]) and MIN_CUSTOMERS <= p["distinct"] < len(df)), None)
    date = next((p for p in profiles if p["role"] == "time"), None)
    value = next((p for p in profiles if p["role"] == "metric" and p.get("type") == "currency" and p.get("numeric", {}).get("sum", 0) > 0), None) \
        or next((p for p in profiles if p["role"] == "metric" and p.get("numeric", {}).get("sum", 0) > 0), None)
    return entity, date, value


def analyze_rfm(df: pd.DataFrame, profiles: list[dict]) -> dict | None:
    entity, date, value = _pick(df, profiles)
    if not (entity and date and value):
        return None
    work = pd.DataFrame({
        "id": df[entity["name"]].astype("string"),
        "d": pd.to_datetime(df[date["name"]], errors="coerce", format="mixed"),
        "v": pd.to_numeric(df[value["name"]], errors="coerce").clip(lower=0),
    }).dropna(subset=["id", "d"])
    if work.empty:
        return None
    as_of = work["d"].max()
    g = work.groupby("id").agg(last=("d", "max"), freq=("d", "size"), monetary=("v", "sum"))
    if len(g) < MIN_CUSTOMERS:
        return None

    recency = (as_of - g["last"]).dt.days.to_numpy()
    r_score = _quintile(recency, higher_is_better=False)
    f_score = _quintile(g["freq"].to_numpy(), higher_is_better=True)
    keys = [next(k for k, _, m in SEGMENTS if m(int(r), int(f))) for r, f in zip(r_score, f_score)]
    g = g.assign(seg=keys)

    grand = float(g["monetary"].sum()) or 1.0
    segments = []
    for key, label, _ in SEGMENTS:
        rows = g[g["seg"] == key]
        if rows.empty:
            continue
        segments.append({
            "key": key, "label": label, "size": int(len(rows)),
            "sharePct": float(len(rows) / len(g) * 100),
            "avgRecencyDays": float((as_of - rows["last"]).dt.days.mean()),
            "avgFrequency": float(rows["freq"].mean()),
            "avgMonetary": float(rows["monetary"].mean()),
            "totalMonetary": float(rows["monetary"].sum()),
            "monetaryShare": float(rows["monetary"].sum() / grand),
        })
    segments.sort(key=lambda s: s["totalMonetary"], reverse=True)
    return {
        "entity": entity["name"], "dateColumn": date["name"], "valueColumn": value["name"],
        "asOf": as_of.strftime("%Y-%m-%d"), "customers": int(len(g)), "segments": segments,
    }
