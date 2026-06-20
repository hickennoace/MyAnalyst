"""Natural segments via k-means (scipy.cluster.vq — no scikit-learn, keeps the Vercel bundle small).

Standardize the numeric metrics, choose k by a simple inertia elbow (accept a larger k only if it cuts
inertia >20%), then describe each cluster by the features that set it apart (high/low vs the overall
average, in std units). Deterministic (seeded).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.cluster.vq import kmeans2

MIN_ROWS = 24
SEED = 1234567


def _inertia(Z, centroids, labels):
    # Vectorized within-cluster sum of squares (gather each row's centroid, then one squared diff) — same
    # result as a per-row Python loop but O(1) numpy passes instead of O(n), which matters at ~100k rows.
    return float(((Z - centroids[labels]) ** 2).sum())


def segment_rows(df: pd.DataFrame, profiles: list[dict]) -> dict | None:
    metrics = [p for p in profiles if p["role"] == "metric" and "numeric" in p and p["numeric"]["std"] > 0][:6]
    if len(metrics) < 2 or len(df) < MIN_ROWS:
        return None
    cols = [m["name"] for m in metrics]
    X = pd.DataFrame({c: pd.to_numeric(df[c], errors="coerce") for c in cols}).dropna()
    if len(X) < MIN_ROWS:
        return None
    mean, std = X.mean(), X.std(ddof=0).replace(0, 1.0)
    Z = ((X - mean) / std).to_numpy()

    runs = {}
    for k in (2, 3, 4):
        if k >= len(Z):
            break
        try:
            centroids, labels = kmeans2(Z, k, seed=SEED, minit="++", missing="raise")
        except Exception:
            continue
        if len(set(labels)) < k:  # an empty cluster — unstable, skip
            continue
        runs[k] = (centroids, labels, _inertia(Z, centroids, labels))
    if 2 not in runs:
        return None
    k = 2
    if 3 in runs and runs[3][2] < 0.8 * runs[2][2]:
        k = 3
    if k == 3 and 4 in runs and runs[4][2] < 0.8 * runs[3][2]:
        k = 4
    centroids, labels, _ = runs[k]

    segments = []
    for c in range(k):
        members = np.where(labels == c)[0]
        if len(members) == 0:
            continue
        defining = []
        for j, col in enumerate(cols):
            zmean = float(Z[members, j].mean())
            defining.append({"column": col, "direction": "high" if zmean >= 0 else "low",
                             "z": zmean, "mean": float(X[col].iloc[members].mean())})
        defining.sort(key=lambda d: abs(d["z"]), reverse=True)
        top = [d for d in defining if abs(d["z"]) > 0.25][:3] or defining[:2]
        label = ", ".join(f"{d['direction']} {d['column']}" for d in top[:2]) if top else "balanced / average"
        segments.append({
            "id": int(c), "label": label[:1].upper() + label[1:],
            "size": int(len(members)), "sharePct": float(len(members) / len(Z) * 100),
            "defining": top,
        })
    segments.sort(key=lambda s: s["size"], reverse=True)
    return {"k": k, "features": cols, "segments": segments,
            "sampled": int(len(Z)) if len(Z) < len(df) else None}
