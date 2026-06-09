"""Time-series helpers: monthly aggregation, MoM/YoY, trend significance, seasonality (statsmodels STL)."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats


def monthly_sum(df: pd.DataFrame, time_col: str, metric: str) -> tuple[list[str], np.ndarray]:
    """Total `metric` summed per month, chronological."""
    t = pd.to_datetime(df[time_col], errors="coerce", format="mixed")
    v = pd.to_numeric(df[metric], errors="coerce")
    g = pd.DataFrame({"m": t.dt.to_period("M"), "v": v}).dropna()
    if g.empty:
        return [], np.array([])
    agg = g.groupby("m")["v"].sum().sort_index()
    return [str(p) for p in agg.index], agg.to_numpy(dtype=float)


def trim_partial_tail(values: np.ndarray) -> np.ndarray:
    if len(values) < 4:
        return values
    prior = values[:-1]
    med = float(np.median(prior))
    return prior if (med > 0 and values[-1] < 0.5 * med) else values


def trend_analysis(labels: list[str], values: np.ndarray, metric: str) -> dict | None:
    """Latest, MoM, YoY, best/worst month, and whether the trend is statistically real (OLS slope p)."""
    if len(values) < 2:
        return None
    latest, previous = float(values[-1]), float(values[-2])
    mom = (latest - previous) / abs(previous) if previous else None
    yoy = None
    if len(values) > 12 and values[-13] != 0:
        yoy = float((latest - values[-13]) / abs(values[-13]))
    x = np.arange(len(values), dtype=float)
    slope, _, r, p, _ = stats.linregress(x, values)
    bi, wi = int(np.argmax(values)), int(np.argmin(values))
    out = {
        "metric": metric, "latest": latest, "changePct": mom, "yoyChangePct": yoy,
        "best": {"label": labels[bi], "value": float(values[bi])},
        "worst": {"label": labels[wi], "value": float(values[wi])},
        "direction": "up" if slope > 0 else "down" if slope < 0 else "flat",
        "slopeP": float(p), "significant": bool(p < 0.05), "rSquared": float(r ** 2),
    }
    out["biggestSwing"] = _biggest_swing(labels, values)
    return out


def _biggest_swing(labels: list[str], values: np.ndarray) -> dict | None:
    """The single sharpest period-over-period move, flagged `notable` when it dwarfs the usual wobble —
    i.e. a regime change ('revenue dropped 40% after March'), the most actionable kind of trend insight."""
    if len(values) < 4:
        return None
    diffs = np.diff(values)
    base = np.abs(values[:-1])
    with np.errstate(divide="ignore", invalid="ignore"):
        rel = np.where(base > 0, diffs / base, np.nan)
    finite = np.abs(rel[np.isfinite(rel)])
    if finite.size < 2:
        return None
    i = int(np.nanargmax(np.where(np.isfinite(rel), np.abs(rel), -1)))
    pct = float(rel[i])
    typical = float(np.median(finite))
    return {
        "fromLabel": labels[i], "toLabel": labels[i + 1],
        "fromValue": float(values[i]), "toValue": float(values[i + 1]),
        "changePct": pct, "direction": "jump" if pct >= 0 else "drop",
        "notable": bool(abs(pct) >= 0.2 and abs(pct) >= 2.5 * typical),
    }


def seasonality_strength(values: np.ndarray, period: int = 12) -> float | None:
    """STL-based seasonal strength in [0,1]: 1 − Var(resid)/Var(resid+seasonal). None if too short."""
    if len(values) < 2 * period:
        return None
    try:
        from statsmodels.tsa.seasonal import STL
        res = STL(pd.Series(values), period=period, robust=True).fit()
        var_r = np.var(res.resid)
        strength = max(0.0, 1.0 - var_r / max(1e-9, np.var(res.resid + res.seasonal)))
        return float(strength)
    except Exception:
        return None
