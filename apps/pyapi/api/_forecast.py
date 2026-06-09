"""Forecasting — statsmodels Holt-Winters when available, else a numpy linear-trend fallback.

Seasonal data → ExponentialSmoothing carries the cycle; otherwise Holt's linear trend. statsmodels MLE-fits
the parameters; if it isn't installed, we fall back to an OLS trend projection so the engine still forecasts
(without the seasonal term). A 95% prediction band widens with the horizon (residual-std × √h).
"""
from __future__ import annotations

import numpy as np

try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing, Holt
    HAS_STATSMODELS = True
except Exception:  # pragma: no cover - exercised only when statsmodels is absent
    HAS_STATSMODELS = False


def _band(fc: np.ndarray, sd: float, last: float, non_negative: bool = False):
    h = np.arange(1, len(fc) + 1)
    lower = fc - 1.96 * sd * np.sqrt(h)
    upper = fc + 1.96 * sd * np.sqrt(h)
    if non_negative:
        # Revenue, units, counts can't go below zero — a negative central projection or 95% floor is
        # mathematically possible from the smoother but physically meaningless, so clamp it.
        fc = np.clip(fc, 0, None)
        lower = np.clip(lower, 0, None)
    return {
        "forecast": [float(x) for x in fc],
        "lower": [float(x) for x in lower],
        "upper": [float(x) for x in upper],
        "lastValue": float(last), "projected": float(fc[-1]),
        "changePct": (float(fc[-1]) - last) / abs(last) if last else 0.0,
        "residualStd": float(sd),
    }


def _linear_fallback(y: np.ndarray, horizon: int) -> dict | None:
    n = len(y)
    x = np.arange(n, dtype=float)
    slope, intercept = np.polyfit(x, y, 1)
    fitted = intercept + slope * x
    sd = float(np.nanstd(y - fitted, ddof=1)) if n > 1 else 0.0
    fc = intercept + slope * np.arange(n, n + horizon, dtype=float)
    out = _band(fc, sd, y[-1], non_negative=bool((y >= 0).all()))
    out.update(seasonal=False, period=None, method="Linear trend")
    return out


def forecast_series(values, horizon: int, seasonal_periods: int | None = None) -> dict | None:
    y = np.asarray([v for v in values if np.isfinite(v)], dtype=float)
    n = len(y)
    if n < 6 or np.nanstd(y) == 0:
        return None
    if not HAS_STATSMODELS:
        return _linear_fallback(y, horizon)

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
        sd = float(np.nanstd(y - np.asarray(model.fittedvalues, dtype=float), ddof=1)) if n > 1 else 0.0
    except Exception:
        return _linear_fallback(y, horizon)
    if not np.all(np.isfinite(fc)):
        return _linear_fallback(y, horizon)
    out = _band(fc, sd, y[-1], non_negative=bool((y >= 0).all()))
    out.update(seasonal=seasonal, period=seasonal_periods if seasonal else None,
               method="Holt-Winters" if seasonal else "Holt")
    return out


def default_horizon(length: int) -> int:
    return max(3, min(12, round(length * 0.15)))
