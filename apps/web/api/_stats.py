"""Rigorous statistics with scipy + statsmodels — the inference layer.

Correlations (with Fisher CIs + FDR control), driver analysis (proper OLS with p-values/CIs/R²), group
comparisons (one-way ANOVA + eta²), and categorical associations (chi-square + Cramér's V). Every result
carries the numbers a statistician would want, written back as plain facts later.
"""
from __future__ import annotations

import re
from itertools import combinations

import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm
from statsmodels.stats.multitest import multipletests

# Reuse the semantics regexes for "don't recommend closing a price gap" (a premium product isn't a laggard).
_UNIT_PRICE = re.compile(r"\b(price|unit[_\s-]?price|msrp|list[_\s-]?price|fee|wage|salary|hourly|per[_\s-]?unit)\b", re.I)
_PRODUCT_DIM = re.compile(r"\b(product|products|model|models|sku|item|items|service|services|plan|plans|brand|brands|category|categories|type|variant|variants|title|make|line|tier|package)\b", re.I)


def is_value_tautology(metric: str, dimension: str) -> bool:
    return bool(_UNIT_PRICE.search(metric) or _PRODUCT_DIM.search(dimension))


def _numeric(df: pd.DataFrame, name: str) -> pd.Series:
    return pd.to_numeric(df[name], errors="coerce")


def correlations(df: pd.DataFrame, metric_names: list[str], top: int = 8) -> list[dict]:
    """Pearson r for every numeric pair, with 95% CI (Fisher z) and FDR-controlled significance."""
    data = {m: _numeric(df, m) for m in metric_names}
    pairs = []
    for a, b in combinations(metric_names, 2):
        s = pd.DataFrame({a: data[a], b: data[b]}).dropna()
        n = len(s)
        if n < 4 or s[a].std() == 0 or s[b].std() == 0:
            continue
        r, p = stats.pearsonr(s[a], s[b])
        # Fisher z 95% CI
        z = np.arctanh(r)
        se = 1.0 / np.sqrt(n - 3)
        lo, hi = np.tanh(z - 1.96 * se), np.tanh(z + 1.96 * se)
        ar = abs(r)
        pairs.append({
            "a": a, "b": b, "r": float(r), "p": float(p), "n": int(n),
            "ciLow": float(lo), "ciHigh": float(hi),
            "strength": "strong" if ar > 0.7 else "moderate" if ar > 0.4 else "weak",
            "redundant": ar >= 0.98,
        })
    if len(pairs) > 1:
        reject = multipletests([x["p"] for x in pairs], method="fdr_bh")[0]
        for x, sig in zip(pairs, reject):
            x["significant"] = bool(sig)
    elif pairs:
        pairs[0]["significant"] = pairs[0]["p"] < 0.05
    pairs.sort(key=lambda x: abs(x["r"]), reverse=True)
    return pairs[:top]


def driver_analysis(df: pd.DataFrame, metric_names: list[str], target: str) -> dict | None:
    """Standardized OLS of `target` on the other metrics → which factors independently move it.

    Standardizing makes the coefficients comparable betas; statsmodels gives real p-values, R², adj-R²,
    and the model F-test. This is the rigorous version of 'what drives X'.
    """
    preds = [m for m in metric_names if m != target]
    if len(preds) < 2:
        return None
    data = pd.DataFrame({c: _numeric(df, c) for c in [target] + preds}).dropna()
    # need enough rows and non-constant columns
    data = data.loc[:, data.std() > 0]
    preds = [p for p in preds if p in data.columns]
    # Drop predictors that are near-DERIVED from the target (|r| ≥ 0.95) — "cost drives price" is a
    # tautology, not a finding. Keeping them also wrecks the regression with collinearity.
    if target in data.columns:
        preds = [p for p in preds if abs(data[target].corr(data[p])) < 0.95]
    if target not in data.columns or len(preds) < 2 or len(data) < len(preds) + 5:
        return None

    z = (data - data.mean()) / data.std(ddof=0)
    X = sm.add_constant(z[preds])
    try:
        model = sm.OLS(z[target], X).fit()
    except Exception:
        return None
    drivers = [{
        "name": p, "beta": float(model.params[p]), "p": float(model.pvalues[p]),
        "ciLow": float(model.conf_int().loc[p, 0]), "ciHigh": float(model.conf_int().loc[p, 1]),
        "significant": bool(model.pvalues[p] < 0.05),
    } for p in preds]
    drivers.sort(key=lambda d: abs(d["beta"]), reverse=True)
    return {
        "target": target, "r2": float(model.rsquared), "adjR2": float(model.rsquared_adj),
        "fP": float(model.f_pvalue), "n": int(len(data)), "drivers": drivers,
    }


def group_comparisons(df: pd.DataFrame, profiles: list[dict], metric_names: list[str], top: int = 4) -> list[dict]:
    """One-way ANOVA of each metric across each low-cardinality dimension, with eta² effect size."""
    dims = [p for p in profiles if p["role"] == "dimension" and 2 <= p["distinct"] <= 20]
    out = []
    for dim in dims[:4]:
        for m in metric_names[:3]:
            sub = pd.DataFrame({"g": df[dim["name"]].astype("string"), "v": _numeric(df, m)}).dropna()
            groups = [g["v"].to_numpy() for _, g in sub.groupby("g") if len(g) >= 2]
            if len(groups) < 2:
                continue
            try:
                f, p = stats.f_oneway(*groups)
            except Exception:
                continue
            if not np.isfinite(f) or not np.isfinite(p):
                continue
            grand = sub["v"].mean()
            ss_between = sum(len(g) * (g.mean() - grand) ** 2 for g in groups)
            ss_total = float(((sub["v"] - grand) ** 2).sum())
            eta2 = ss_between / ss_total if ss_total > 0 else 0.0
            means = sub.groupby("g")["v"].mean().sort_values(ascending=False)
            out.append({
                "metric": m, "dimension": dim["name"], "f": float(f), "p": float(p), "etaSq": float(eta2),
                "top": {"name": str(means.index[0]), "mean": float(means.iloc[0])},
                "bottom": {"name": str(means.index[-1]), "mean": float(means.iloc[-1]),
                           "n": int((sub["g"] == means.index[-1]).sum())},
                "valueTautology": is_value_tautology(m, dim["name"]),
            })
    if len(out) > 1:
        reject = multipletests([x["p"] for x in out], method="fdr_bh")[0]
        for x, sig in zip(out, reject):
            x["significant"] = bool(sig)
    elif out:
        out[0]["significant"] = out[0]["p"] < 0.05
    out.sort(key=lambda x: (x.get("significant", False), x["etaSq"]), reverse=True)
    return out[:top]


def associations(df: pd.DataFrame, profiles: list[dict], top: int = 4) -> list[dict]:
    """Chi-square test of independence between categorical pairs, with Cramér's V."""
    cats = [p for p in profiles if p["role"] in ("dimension",) and 2 <= p["distinct"] <= 15]
    out = []
    for a, b in combinations(cats, 2):
        ct = pd.crosstab(df[a["name"]], df[b["name"]])
        if ct.shape[0] < 2 or ct.shape[1] < 2:
            continue
        try:
            chi2, p, _, _ = stats.chi2_contingency(ct)
        except Exception:
            continue
        n = ct.to_numpy().sum()
        k = min(ct.shape) - 1
        v = np.sqrt(chi2 / (n * k)) if n and k else 0.0
        out.append({"a": a["name"], "b": b["name"], "chi2": float(chi2), "p": float(p),
                    "cramersV": float(v), "significant": bool(p < 0.05)})
    out.sort(key=lambda x: (x["significant"], x["cramersV"]), reverse=True)
    return out[:top]
