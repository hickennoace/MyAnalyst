"""Forecasting with statsmodels Holt-Winters (triple exponential smoothing).

Seasonal data → ExponentialSmoothing carries the cycle; otherwise Holt's linear trend. A 95% prediction
band widens with the horizon (residual-std × √h). Far better than the hand-rolled TS version because the
parameters are MLE-fit by statsmodels.
"""
from __future__ import annotations

import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing, Holt


def forecast_series(values, horizon: int, seasonal_periods: int | None = None) -> dict | None:
    y = np.asarray([v for v in values if np.isfinite(v)], dtype=float)
    n = len(y)
    if n < 6 or np.nanstd(y) == 0:
        return None
    seasonal = bool(seasonal_periods and n >= 2 * seasonal_periods)
    try:
        if seasonal:
            model = ExponentialSmoothing(
                y, trend="add", seasonal="add", seasonal_periods=seasonal_periods,
                initialization_method="estimated",
            ).fit()
        else:
            model = Holt(y, initialization_method="estimated").fit()
        fc = np.asarray(model.forecast(horizon), dtype=float)
        resid = y - np.asarray(model.fittedvalues, dtype=float)
        sd = float(np.nanstd(resid, ddof=1)) if n > 1 else 0.0
    except Exception:
        return None
    if not np.all(np.isfinite(fc)):
        return None
    h = np.arange(1, horizon + 1)
    last, proj = float(y[-1]), float(fc[-1])
    return {
        "forecast": [float(x) for x in fc],
        "lower": [float(x) for x in fc - 1.96 * sd * np.sqrt(h)],
        "upper": [float(x) for x in fc + 1.96 * sd * np.sqrt(h)],
        "lastValue": last, "projected": proj,
        "changePct": (proj - last) / abs(last) if last else 0.0,
        "seasonal": seasonal, "period": seasonal_periods if seasonal else None,
        "residualStd": sd, "method": "Holt-Winters" if seasonal else "Holt",
    }


def default_horizon(length: int) -> int:
    return max(3, min(12, round(length * 0.15)))
