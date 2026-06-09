"""Emit a headline summary of the Python analysis for a CSV — used by the TS↔Python parity check.
Run: py apps/web/api/_parity_one.py <path-to-csv>
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # import siblings regardless of cwd

import pandas as pd  # noqa: E402
from _engine import analyze  # noqa: E402

df = pd.read_csv(sys.argv[1])
spec = analyze(df)
bs = spec.get("bestSellers") or {}
print(json.dumps({
    "domain": spec["domain"]["domain"],
    "topKpi": spec["kpis"][0]["name"] if spec["kpis"] else None,
    "kpiNames": [k["name"] for k in spec["kpis"]],
    "kpis": {k["name"]: k["value"] for k in spec["kpis"]},
    "bestSellerDim": bs.get("dimension"),
    "topRevenue": (bs.get("topRevenue") or {}).get("name"),
}, default=str))
