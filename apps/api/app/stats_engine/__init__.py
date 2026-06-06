"""Stage 5 — Statistics & forecasting engine.

Pick and run the appropriate statistical tools for the dataset's domain/shape, and
attach a plain-language, NON-condescending "what this is / what it found" block to each.

Toolbox:
    * correlation  — Pearson + significance (reuse notebook code), correlation matrix,
    * regression   — OLS via statsmodels: coefficients, R², p-values, CIs; auto target/
                     feature selection heuristics,
    * forecasting  — statsforecast ARIMA/ETS for time-series,
    * anomaly      — z-score / IsolationForest (fast-follow),
    * tests        — t-test / ANOVA with friendly explanations (fast-follow).

Honesty rule: report sample size + p-values; warn on "not enough data"; never overclaim.
All numbers are computed HERE (locally). The LLM only narrates them later.

TODO: implement analysis selectors + result dataclasses with explanation templates.
"""
