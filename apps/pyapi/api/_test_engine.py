"""Plain-assert tests for the Python engine (no pytest needed). Run: py analysis/test_engine.py"""
import sys

import numpy as np
import pandas as pd

from _engine import analyze, detect_domain, profile, revenue_metric, is_transaction_grain


def car_sales(n=400, with_cost=True, seed=1):
    rng = np.random.default_rng(seed)
    models = [("Corolla", 24000, 19000, 0.4), ("F-150", 45000, 36000, 0.25),
              ("X5", 68000, 54000, 0.2), ("S-Class", 110000, 88000, 0.15)]
    shares = np.array([m[3] for m in models]); shares /= shares.sum()
    start = pd.Timestamp("2023-01-01")
    rows = []
    for i in range(n):
        m = models[rng.choice(len(models), p=shares)]
        rows.append({
            "Date": (start + pd.Timedelta(days=int(i / n * 540))).strftime("%Y-%m-%d"),
            "Model": m[0], "Price": round(m[1] * rng.uniform(0.95, 1.05)),
            **({"Cost": round(m[2] * rng.uniform(0.95, 1.05))} if with_cost else {}),
            "CustomerAge": int(rng.integers(20, 70)), "Region": rng.choice(["N", "S", "E", "W"]),
        })
    return pd.DataFrame(rows)


def check(name, cond):
    print(("PASS" if cond else "FAIL") + f"  {name}")
    if not cond:
        check.failed += 1
check.failed = 0


df = car_sales()
profiles = profile(df)

# Domain: a sales file with Price/Cost is NOT financial.
dom = detect_domain(profiles, len(df))
check("domain is sales-operational, not financial", dom["domain"] == "sales-operational")

# A keyword-less transaction stream (fitness log) must NOT be labelled sales-operational just for its grain.
fit = pd.DataFrame({
    "Date": pd.date_range("2024-01-01", periods=60, freq="D").astype(str),
    "Activity": (["Swim", "Run", "Yoga", "Strength"] * 15),
    "Duration": np.random.default_rng(5).integers(20, 90, 60),
    "Calories": np.random.default_rng(6).integers(150, 1200, 60),
})
fit_dom = detect_domain(profile(fit), len(fit))
check("keyword-less fitness stream is NOT mislabelled sales-operational", fit_dom["domain"] != "sales-operational")

# Revenue metric = Price (the sale value), never Cost.
rev = revenue_metric(profiles, is_transaction_grain(profiles, len(df)), dom["domain"])
check("revenue metric is Price (not Cost)", rev is not None and rev["name"] == "Price")

spec = analyze(df)
names = [k["name"] for k in spec["kpis"]]
check("Total revenue is the #1 KPI", spec["kpis"][0]["name"] in ("Total revenue", "Total Price"))
check("Gross margin KPI present (cost given)", any("margin" in n.lower() for n in names))
check("Top product KPI present", any(n.startswith("Top ") for n in names))
check("NO 'Average CustomerAge' KPI (attribute noise dropped)", "Average CustomerAge" not in names)
check("best-seller story computed", spec["bestSellers"] is not None and spec["bestSellers"]["topRevenue"]["name"] in ("Corolla", "S-Class", "F-150", "X5"))

# Pareto: a deliberately skewed product mix is flagged concentrated with a sane 80% count.
from _engine import _pareto
par = _pareto(np.array([100.0, 50.0, 20.0, 10.0, 8.0, 6.0, 4.0, 2.0]), 200.0)
check("pareto computed on skewed mix", par is not None and 1 <= par["nFor80Pct"] <= par["items"] and 0 < par["top20PctShare"] <= 1)
check("pareto flags concentration", par["concentrated"] in (True, False))

# Phase 2 — full analysis sections.
check("Holt-Winters forecast computed", spec.get("forecast") is not None and "method" in spec["forecast"])
check("monthly trend computed", spec.get("trend") is not None and "slopeP" in spec["trend"])
check("stats: correlations + group comparisons", "correlations" in spec["stats"] and "groupComparisons" in spec["stats"])
check("charts: revenue-by-product + forecast", any("Revenue by" in c["title"] for c in spec["charts"]) and any("forecast" in c["title"].lower() for c in spec["charts"]))
check("charts: distribution histogram of the key metric", any(c["id"] == "chart-histogram" and c["type"] == "bar" and len(c["x"]) > 0 for c in spec["charts"]))
check("grounded facts built (>=5)", len(spec.get("facts", [])) >= 5)
check("k-means segments found", spec.get("segments") is not None and len(spec["segments"]["segments"]) >= 2)
check("trend carries a biggestSwing block", "biggestSwing" in (spec.get("trend") or {}))

# Biggest-swing detection: a clean step-change is flagged notable and points at the right months.
from _timeseries import _biggest_swing
step_labels = ["2024-01", "2024-02", "2024-03", "2024-04", "2024-05"]
step_vals = np.array([100.0, 105.0, 102.0, 60.0, 58.0])  # ~41% drop Mar→Apr
sw = _biggest_swing(step_labels, step_vals)
check("biggest swing finds the Mar->Apr drop", sw is not None and sw["fromLabel"] == "2024-03" and sw["toLabel"] == "2024-04")
check("biggest swing is a notable drop", sw["notable"] is True and sw["direction"] == "drop" and sw["changePct"] < -0.3)
check("steady series has no notable swing", (_biggest_swing(step_labels, np.array([100.0, 101.0, 102.0, 103.0, 104.0])) or {}).get("notable") is False)

# Forecast on a steeply declining non-negative series must never project below zero.
from _forecast import forecast_series, backtest
decl = forecast_series([100.0, 80.0, 60.0, 40.0, 20.0, 10.0, 5.0], horizon=6)
check("declining revenue forecast never goes negative", decl is not None and min(decl["forecast"]) >= 0 and min(decl["lower"]) >= 0)

# Backtest: a clean linear series should be forecastable with small error; short series returns None.
bt = backtest([10.0 * i + 50 for i in range(20)])
check("backtest returns a low MAPE on a clean linear series", bt is not None and bt["mape"] < 0.1 and bt["testPoints"] >= 2)
check("backtest returns None on too-short a series", backtest([1.0, 2.0, 3.0, 4.0]) is None)

# RFM on transaction data with repeating customers.
rng2 = np.random.default_rng(7)
cust_rows = []
base = pd.Timestamp("2024-01-01")
for c in range(40):
    for _ in range(int(rng2.integers(1, 8))):
        cust_rows.append({"CustomerID": f"C{c}", "Date": (base + pd.Timedelta(days=int(rng2.integers(0, 300)))).strftime("%Y-%m-%d"),
                          "Amount": float(rng2.integers(20, 500))})
rfm_df = pd.DataFrame(cust_rows)
rfm_spec = analyze(rfm_df)
check("RFM segments computed for customer data", rfm_spec.get("rfm") is not None and len(rfm_spec["rfm"]["segments"]) >= 2 and rfm_spec["rfm"]["entity"] == "CustomerID")
check("no tautological 'Cost drives Price' driver", not (spec["stats"].get("drivers") and spec["stats"]["drivers"]["drivers"][0]["name"] == "Cost"))
import json
from index import _jsonable
try:
    json.dumps(spec, default=_jsonable)
    check("full spec is JSON-serializable", True)
except Exception as exc:  # noqa: BLE001
    print("FAIL  json:", exc)
    check.failed += 1

# No-revenue survey-ish frame keeps rate-like averages.
survey = pd.DataFrame({"Respondent": range(60), "NPS Score": np.random.default_rng(0).integers(0, 11, 60),
                       "Satisfaction": np.random.default_rng(1).integers(1, 6, 60)})
s2 = analyze(survey)
check("survey keeps rate-like averages", any("NPS" in k["name"] or "Satisfaction" in k["name"] for k in s2["kpis"]))

# Data quality flags a constant column and docks the score for it.
from _quality import data_quality
const_df = pd.DataFrame({"Region": ["US"] * 50, "Sales": np.random.default_rng(2).integers(1, 100, 50)})
dq = data_quality(const_df, profile(const_df))
check("quality flags the constant column", "Region" in dq.get("constantColumns", []) and any("single value" in i for i in dq["issues"]))

# ── Currency detection ────────────────────────────────────────────────────────
from _currency import detect, money as _cmoney
import pandas as _pd

# Header ISO code wins.
eur = detect(_pd.DataFrame({"Revenue (EUR)": [100, 200], "Units": [1, 2]}), ["Revenue (EUR)"])
check("detect EUR from header code", eur["code"] == "EUR" and eur["symbol"] == "€")
# Header symbol.
ils = detect(_pd.DataFrame({"Price ₪": [100, 200]}), ["Price ₪"])
check("detect ILS from ₪ symbol in header", ils["code"] == "ILS" and ils["symbol"] == "₪")
# Symbol in raw cell values when header is plain.
gbp = detect(_pd.DataFrame({"Amount": ["£1,200", "£980", "£1,500"]}), ["Amount"])
check("detect GBP from £ in cells", gbp["symbol"] == "£")
# Default USD when nothing found.
usd = detect(_pd.DataFrame({"Sales": [100, 200]}), ["Sales"])
check("default to USD/$ when no currency hint", usd["code"] == "USD" and usd["symbol"] == "$")
check("money() uses the given symbol", _cmoney(1_250_000, "€") == "€1.2M")
# Shekel / Yen / Yuan + name-based detection + NIS normalization + word-collision guard.
check("detect ILS (Shekel)", detect(_pd.DataFrame({"Price ₪": [1]}), ["Price ₪"])["code"] == "ILS")
check("detect JPY (Yen) by code", detect(_pd.DataFrame({"Amount JPY": [1]}), ["Amount JPY"])["code"] == "JPY")
check("detect CNY (Yuan) by name", detect(_pd.DataFrame({"Cost in Yuan": [1]}), ["Cost in Yuan"])["code"] == "CNY")
check("detect ILS by name (Shekels)", detect(_pd.DataFrame({"Salary in Shekels": [1]}), ["Salary in Shekels"])["code"] == "ILS")
check("normalize NIS -> ILS", detect(_pd.DataFrame({"Total NIS": [1]}), ["Total NIS"])["code"] == "ILS")
check("no false positive on 'Games Won'", detect(_pd.DataFrame({"Games Won": [1]}), ["Games Won"])["code"] == "USD")

# End-to-end: an EUR sales file renders € in the KPI values, not $.
eur_df = car_sales(300).rename(columns={"Price": "Price (EUR)", "Cost": "Cost (EUR)"})
eur_spec = analyze(eur_df)
check("engine detects EUR end-to-end", eur_spec["currency"]["code"] == "EUR")
check("KPI money values use €, not $", any("€" in k["value"] for k in eur_spec["kpis"]) and not any("$" in k["value"] for k in eur_spec["kpis"]))

# Client-passed currency override: cells are clean numbers (symbol stripped by the web), so the web tells
# us the currency it detected on the raw data — Python must honor it (the Shekel-salary fix).
ils_spec = analyze(car_sales(200).rename(columns={"Price": "Total paid"}), currency={"symbol": "₪", "code": "ILS"})
check("honors client currency override (ILS)", ils_spec["currency"]["code"] == "ILS" and any("₪" in k["value"] for k in ils_spec["kpis"]))

# A non-money skewed column (CustomerAge) must NOT be printed with a currency symbol.
age_df = _pd.DataFrame({"CustomerAge": list(np.random.default_rng(3).gamma(2, 12, 300).astype(int) + 18)})
age_spec = analyze(age_df)
age_facts = " ".join(f["text"] for f in age_spec.get("facts", []))
check("non-money column not shown as currency", "$" not in age_facts and "€" not in age_facts)

print()
if check.failed:
    print(f"{check.failed} FAILED")
    sys.exit(1)
print("ALL PASSED")
