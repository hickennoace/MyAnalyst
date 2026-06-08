"""Plain-assert tests for the Python engine (no pytest needed). Run: py analysis/test_engine.py"""
import sys

import numpy as np
import pandas as pd

from engine import analyze, detect_domain, profile, revenue_metric, is_transaction_grain


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

# No-revenue survey-ish frame keeps rate-like averages.
survey = pd.DataFrame({"Respondent": range(60), "NPS Score": np.random.default_rng(0).integers(0, 11, 60),
                       "Satisfaction": np.random.default_rng(1).integers(1, 6, 60)})
s2 = analyze(survey)
check("survey keeps rate-like averages", any("NPS" in k["name"] or "Satisfaction" in k["name"] for k in s2["kpis"]))

print()
if check.failed:
    print(f"{check.failed} FAILED")
    sys.exit(1)
print("ALL PASSED")
