"""Outlier analysis that knows a skewed SEGMENT from a real ANOMALY (scipy.stats).

A heavy one-sided tail (a premium price tier) is distribution SHAPE — report it and steer to the median,
don't cry "errors". A few isolated points (or an absurd 50× spike) are anomalies worth checking.

Flagging uses the ROBUST modified z-score (median + MAD), not the classic mean/std z. The mean and SD are
themselves dragged by the very outliers we're hunting (a single 50× spike inflates SD so nothing — not even
the spike — clears 3σ: the "masking" effect). The median/MAD are unmoved by a few extremes, so genuine
anomalies actually surface. We fall back to mean/SD only when MAD is 0 (a column more than half identical),
where the modified z is undefined.
"""
from __future__ import annotations

import numpy as np
from scipy import stats

# Iglewicz–Hoaglin: M_i = 0.6745·(x−median)/MAD is ~N(0,1) for normal data, so 3.5 is the standard cutoff
# (slightly stricter than the classic 3σ, which is the point — robust scores catch real outliers cleanly).
_MAD_TO_SIGMA = 0.6745
_MOD_Z_CUTOFF = 3.5


def analyze_column_outliers(name: str, values, std_threshold: float = 3.0) -> dict | None:
    x = np.asarray([v for v in values if np.isfinite(v)], dtype=float)
    n = len(x)
    if n < 8:
        return None
    mu, sigma = float(x.mean()), float(x.std(ddof=1))
    if sigma == 0:  # a constant column has no outliers
        return None
    med = float(np.median(x))
    skew = float(stats.skew(x))

    mad = float(np.median(np.abs(x - med)))
    if mad > 0:
        scores = _MAD_TO_SIGMA * (x - med) / mad  # robust modified z-score
        cutoff, scale = _MOD_Z_CUTOFF, "mad"
    else:
        # >50% of values identical → MAD is 0 and the robust score blows up; fall back to classic z.
        scores = (x - mu) / sigma
        cutoff, scale = std_threshold, "std"

    idx = np.where(np.abs(scores) >= cutoff)[0]
    if idx.size == 0:
        return None

    svals = scores[idx]
    order = idx[np.argsort(-np.abs(svals))]
    examples = [{"value": float(x[i]), "z": float(scores[i])} for i in order[:4]]
    high = int((svals > 0).sum())
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
        "scale": scale, "examples": examples,
    }
