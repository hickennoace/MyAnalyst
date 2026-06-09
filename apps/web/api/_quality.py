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
    if duplicates:
        issues.append(f"{duplicates:,} duplicate row{'s' if duplicates != 1 else ''}")

    score = round(max(0.0, min(1.0, completeness * 0.7 + (1 - dup_rate) * 0.3)) * 100)
    return {
        "score": score,
        "rows": n,
        "columns": len(profiles),
        "duplicates": duplicates,
        "completeness": round(completeness, 3),
        "issues": issues[:5],
        "rating": "good" if score >= 85 else "fair" if score >= 65 else "weak",
    }
