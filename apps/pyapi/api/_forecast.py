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


def _band(fc: np.ndarray, sd: float, last: float):
    h = np.arange(1, len(fc) + 1)
    return {
        "forecast": [float(x) for x in fc],
        "lower": [float(x) for x in fc - 1.96 * sd * np.sqrt(h)],
        "upper": [float(x) for x in fc + 1.96 * sd * np.sqrt(h)],
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
    out = _band(fc, sd, y[-1])
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
    out = _band(fc, sd, y[-1])
    out.update(seasonal=seasonal, period=seasonal_periods if seasonal else None,
               method="Holt-Winters" if seasonal else "Holt")
    return out


def default_horizon(length: int) -> int:
    return max(3, min(12, round(length * 0.15)))
