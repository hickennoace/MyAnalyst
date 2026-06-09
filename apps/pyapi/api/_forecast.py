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


def _fit_forecast(y: np.ndarray, horizon: int, seasonal_periods: int | None) -> np.ndarray | None:
    """Just the point forecast (no band) — used by the backtest. Mirrors forecast_series's model choice."""
    n = len(y)
    if n < 4 or np.nanstd(y) == 0:
        return None
    if not HAS_STATSMODELS:
        x = np.arange(n, dtype=float)
        slope, intercept = np.polyfit(x, y, 1)
        return intercept + slope * np.arange(n, n + horizon, dtype=float)
    try:
        if seasonal_periods and n >= 2 * seasonal_periods:
            m = ExponentialSmoothing(y, trend="add", seasonal="add", seasonal_periods=seasonal_periods,
                                     initialization_method="estimated").fit()
        else:
            m = Holt(y, initialization_method="estimated").fit()
        fc = np.asarray(m.forecast(horizon), dtype=float)
        return fc if np.all(np.isfinite(fc)) else None
    except Exception:
        return None


def backtest(values, seasonal_periods: int | None = None) -> dict | None:
    """Holdout backtest: hide the last few points, forecast them from the rest, and measure the error.
    Gives the user an honest read on how much to trust the projection ("typically within ~X%")."""
    y = np.asarray([v for v in values if np.isfinite(v)], dtype=float)
    n = len(y)
    test_n = min(max(2, n // 5), 6)
    if n - test_n < 6:  # need enough training history for a meaningful fit
        return None
    train, actual = y[:-test_n], y[-test_n:]
    pred = _fit_forecast(train, test_n, seasonal_periods)
    if pred is None or len(pred) != test_n:
        return None
    # MAPE only over actuals large enough for a percentage to be meaningful (avoids divide-by-near-zero).
    thresh = 0.01 * float(np.mean(np.abs(y))) or 1e-9
    mask = np.abs(actual) > thresh
    if mask.sum() < 2:
        return None
    mape = float(np.mean(np.abs((actual[mask] - pred[mask]) / actual[mask])))
    mae = float(np.mean(np.abs(actual - pred)))
    return {"mape": mape, "mae": mae, "testPoints": int(test_n)}


def default_horizon(length: int) -> int:
    return max(3, min(12, round(length * 0.15)))
