"""Verify the Python engine on synthetic car-sales data. Run: py analysis/demo.py"""
import json
import numpy as np
import pandas as pd

from _engine import analyze

MODELS = [
    ("Toyota", "Corolla", 24000, 19000, 0.26),
    ("Toyota", "RAV4", 32000, 25000, 0.20),
    ("Honda", "Civic", 26000, 21000, 0.16),
    ("Ford", "F-150", 45000, 36000, 0.12),
    ("BMW", "X5", 68000, 54000, 0.06),
    ("Mercedes", "S-Class", 110000, 88000, 0.03),
    ("Honda", "Accord", 30000, 24000, 0.10),
    ("Ford", "Focus", 22000, 18000, 0.07),
]
rng = np.random.default_rng(42)
N = 1500
start = pd.Timestamp("2023-01-01")
rows = []
shares = np.array([m[4] for m in MODELS])
shares = shares / shares.sum()
for i in range(N):
    m = MODELS[rng.choice(len(MODELS), p=shares)]
    day = int((i / N) * 730 + rng.uniform(0, 20))
    rows.append({
        "Date": (start + pd.Timedelta(days=day)).strftime("%Y-%m-%d"),
        "Brand": m[0], "Model": m[1],
        "Price": round(m[2] * rng.uniform(0.92, 1.08)),
        "Cost": round(m[3] * rng.uniform(0.92, 1.08)),
        "CustomerAge": int(rng.integers(22, 67)),
        "Region": rng.choice(["North", "South", "East", "West"]),
    })

df = pd.DataFrame(rows)
spec = analyze(df)

print(f"DOMAIN: {spec['domain']['domain']} ({spec['domain']['confidence']*100:.0f}%)")
print("\nKPIs (what the dashboard shows):")
for k in spec["kpis"][:8]:
    print(f"  {k['name']:<26} = {k['value']}")
bs = spec["bestSellers"]
if bs:
    print(f"\nBEST SELLER dim: {bs['dimension']}  |  top revenue: {bs['topRevenue']['name']} "
          f"({bs['topRevenue']['revenueShare']*100:.0f}%)  |  top units: {bs['topUnits']['name']}")

fc = spec.get("forecast")
if fc:
    print(f"\nFORECAST ({fc['method']}): next-month revenue change {fc['changePct']*100:+.1f}% "
          f"(seasonal={fc['seasonal']})")
st = spec.get("stats", {})
if st.get("drivers"):
    d = st["drivers"]
    lead = d["drivers"][0]
    print(f"DRIVER (OLS R^2={d['r2']:.2f}): {lead['name']} beta={lead['beta']:.2f} p={lead['p']:.3f}")
if st.get("correlations"):
    c = st["correlations"][0]
    print(f"TOP CORRELATION: {c['a']}~{c['b']} r={c['r']:.2f} p={c['p']:.3g} sig={c.get('significant')}")
print(f"\nCHARTS: {[c['title'] for c in spec['charts']]}")
print("\nFACTS (the LLM concludes from these):")
for f in spec["facts"][:10]:
    print(f"  - {f['text']}")

# JSON serialization must succeed (numpy/NaN safe) for the Vercel handler.
import json
from index import _jsonable
blob = json.dumps(spec, default=_jsonable)
print(f"\nJSON OK: {len(blob):,} bytes")
