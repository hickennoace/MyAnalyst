"""Outlier analysis that knows a skewed SEGMENT from a real ANOMALY (scipy.stats).

A heavy one-sided tail (a premium price tier) is distribution SHAPE — report it and steer to the median,
don't cry "errors". A few isolated points (or an absurd 50× spike) are anomalies worth checking.
"""
from __future__ import annotations

import numpy as np
from scipy import stats


def analyze_column_outliers(name: str, values, threshold: float = 3.0) -> dict | None:
    x = np.asarray([v for v in values if np.isfinite(v)], dtype=float)
    n = len(x)
    if n < 8:
        return None
    mu, sigma = float(x.mean()), float(x.std(ddof=1))
    if sigma == 0:
        return None
    med = float(np.median(x))
    skew = float(stats.skew(x))
    z = (x - mu) / sigma
    mask = np.abs(z) >= threshold
    idx = np.where(mask)[0]
    if idx.size == 0:
        return None

    zvals = z[idx]
    order = idx[np.argsort(-np.abs(zvals))]
    examples = [{"value": float(x[i]), "z": float((x[i] - mu) / sigma)} for i in order[:4]]
    high = int((zvals > 0).sum())
    low = int(idx.size - high)
    direction = "both" if high and low else ("high" if high else "low")
    share = idx.size / n
    one_sided = max(high, low) / idx.size
    tail_ratio = abs(examples[0]["value"]) / (abs(med) or 1.0)

    looks_like_segment = idx.size >= 5 and one_sided >= 0.8 and abs(skew) > 1 and tail_ratio <= 15
    kind = "skew" if looks_like_segment else "anomaly"
    return {
        "column": name, "count": int(idx.size), "share": float(share), "kind": kind,
        "direction": direction, "skew": skew, "mean": mu, "median": med, "std": sigma,
        "examples": examples,
    }
