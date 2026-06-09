"""Per-metric distribution shape + normality (scipy).

Skewness, kurtosis, and a Jarque-Bera normality test — so the engine knows when the mean is honest vs
when the median is the better "typical" value, and can say so.
"""
from __future__ import annotations

import pandas as pd
from scipy import stats


def distributions(df: pd.DataFrame, profiles: list[dict]) -> list[dict]:
    out = []
    for p in profiles:
        if p["role"] != "metric" or "numeric" not in p:
            continue
        v = pd.to_numeric(df[p["name"]], errors="coerce").dropna()
        if len(v) < 20 or v.std() == 0:
            continue
        skew = float(stats.skew(v))
        kurt = float(stats.kurtosis(v))  # excess kurtosis
        try:
            jb_p = float(stats.jarque_bera(v)[1])
        except Exception:
            jb_p = None
        shape = "right-skewed" if skew > 0.5 else "left-skewed" if skew < -0.5 else "roughly symmetric"
        out.append({
            "column": p["name"], "skew": skew, "kurtosis": kurt,
            "jarqueBeraP": jb_p, "normal": jb_p is not None and jb_p > 0.05,
            "shape": shape, "mean": p["numeric"]["mean"], "median": p["numeric"]["median"],
        })
    return out
