"""Stage 4 — KPI engine.

A registry of KPI rules keyed by (domain, required column roles). Given a dataset
profile, select the relevant rules, rank by importance, and compute values + trends.

v1 = financial domain. Port proven implementations from the sibling JupyterProject
ETH notebook:
    * returns (simple / log), CAGR (geometric),
    * annualized volatility,
    * Sharpe / Sortino / Calmar ratios,
    * max drawdown & recovery,
    * MoM / YoY deltas.

Each computed KPI yields {name, value, unit, trend, period, how_computed} for the
dashboard spec and for grounding insight narratives.

TODO: implement KpiRule protocol + a financial rule pack + ranking.
"""
