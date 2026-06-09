"""Data-quality summary — completeness, duplicates, and per-column fill, with a 0-100 score.

The plain-English counterpart to the TS cleaning report: tells the user how trustworthy the numbers are
before they lean on them.
"""
from __future__ import annotations

import pandas as pd


def data_quality(df: pd.DataFrame, profiles: list[dict]) -> dict:
    n = len(df)
    duplicates = int(df.duplicated().sum())
    completeness = sum(p["fill"] for p in profiles) / len(profiles) if profiles else 1.0
    dup_rate = duplicates / n if n else 0.0

    issues = []
    for p in sorted(profiles, key=lambda x: x["fill"]):
        miss = 1 - p["fill"]
        if miss > 0.1:
            issues.append(f"\"{p['name']}\" is {miss*100:.0f}% empty")
    # Constant columns carry zero information — usually an export artifact (a filter left on, a fixed field).
    constants = [p["name"] for p in profiles if n > 1 and p["distinct"] <= 1 and p["fill"] > 0]
    for name in constants[:3]:
        issues.append(f"\"{name}\" has a single value (no variation)")
    if duplicates:
        issues.append(f"{duplicates:,} duplicate row{'s' if duplicates != 1 else ''}")

    # Score blends completeness, dedup, and a small penalty for dead (constant) columns.
    const_penalty = min(0.15, 0.05 * len(constants))
    score = round(max(0.0, min(1.0, completeness * 0.7 + (1 - dup_rate) * 0.3 - const_penalty)) * 100)
    return {
        "score": score,
        "rows": n,
        "columns": len(profiles),
        "duplicates": duplicates,
        "completeness": round(completeness, 3),
        "constantColumns": constants,
        "issues": issues[:5],
        "rating": "good" if score >= 85 else "fair" if score >= 65 else "weak",
    }
