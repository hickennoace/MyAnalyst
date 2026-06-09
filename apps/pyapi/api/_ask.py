"""Ask-your-data: answer a natural-language question about the dataset.

Computes the relevant statistics IN PANDAS (per-column summaries + group-bys for the columns mentioned in
the question), hands them to Groq to phrase a grounded answer, and falls back to a deterministic computed
answer for simple aggregations when the LLM is unavailable. The numbers always come from pandas — the LLM
only phrases them.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

import _groq

SYSTEM = (
    "You answer questions about a dataset for a non-technical user. You are given the question, the dataset's "
    "COMPUTED STATISTICS, and known FACTS. Answer in 1-3 sentences using ONLY the numbers provided — never "
    "invent figures; if the answer isn't derivable from them, say what's missing. Lead with the number, then "
    'what it means. Output STRICT JSON: {"answer": str}'
)


def _is_numeric(s: pd.Series) -> bool:
    return pd.to_numeric(s, errors="coerce").notna().mean() > 0.8


def _profile_context(df: pd.DataFrame) -> list[str]:
    lines = []
    for col in df.columns:
        s = df[col]
        if _is_numeric(s):
            v = pd.to_numeric(s, errors="coerce").dropna()
            if len(v):
                lines.append(f"{col} (numeric): sum={v.sum():,.0f}, mean={v.mean():,.2f}, median={v.median():,.2f}, "
                             f"min={v.min():,.0f}, max={v.max():,.0f}, count={len(v)}")
        else:
            vc = s.astype("string").value_counts().head(6)
            lines.append(f"{col} (category, {s.nunique()} distinct): " + ", ".join(f"{k}={c}" for k, c in vc.items()))
    return lines


def _groupby_context(df: pd.DataFrame, question: str) -> list[str]:
    q = question.lower()
    cats = [c for c in df.columns if not _is_numeric(df[c]) and c.lower() in q]
    nums = [c for c in df.columns if _is_numeric(df[c]) and c.lower() in q]
    out = []
    for cat in cats[:2]:
        for num in nums[:2]:
            g = pd.DataFrame({"k": df[cat].astype("string"), "v": pd.to_numeric(df[num], errors="coerce")}).dropna()
            agg = g.groupby("k")["v"].agg(["sum", "mean"]).sort_values("sum", ascending=False).head(8)
            out.append(f"{num} by {cat} (sum, mean): " + "; ".join(f"{i}={r['sum']:,.0f}/{r['mean']:,.1f}" for i, r in agg.iterrows()))
        if not nums:  # category mentioned, no metric → counts
            vc = df[cat].astype("string").value_counts().head(8)
            out.append(f"{cat} counts: " + "; ".join(f"{k}={c}" for k, c in vc.items()))
    return out


def _simple_answer(df: pd.DataFrame, question: str) -> str:
    q = question.lower()
    nums = [c for c in df.columns if _is_numeric(df[c])]
    if "how many" in q or "count" in q or "number of rows" in q:
        return f"There are {len(df):,} rows in the dataset."
    target = next((c for c in nums if c.lower() in q), nums[0] if nums else None)
    if not target:
        return "I couldn't find a numeric column to compute from your question."
    v = pd.to_numeric(df[target], errors="coerce").dropna()
    if any(w in q for w in ("average", "avg", "mean")):
        return f"The average {target} is {v.mean():,.2f}."
    if "median" in q:
        return f"The median {target} is {v.median():,.2f}."
    if any(w in q for w in ("max", "highest", "largest", "most")):
        return f"The highest {target} is {v.max():,.2f}."
    if any(w in q for w in ("min", "lowest", "smallest", "least")):
        return f"The lowest {target} is {v.min():,.2f}."
    return f"The total {target} is {v.sum():,.2f}."


def answer_question(df: pd.DataFrame, question: str, facts: list[dict] | None = None) -> dict:
    context = _profile_context(df) + _groupby_context(df, question)
    facts_text = "\n".join(f"- {f['text']}" for f in (facts or []))
    user = (f"Question: {question}\n\nCOMPUTED STATISTICS:\n" + "\n".join(context)
            + (f"\n\nKNOWN FACTS:\n{facts_text}" if facts_text else "") + "\n\nAnswer as JSON.")
    raw = _groq.chat([{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}], temperature=0.3)
    if raw:
        try:
            ans = json.loads(raw).get("answer", "").strip()
            if ans:
                return {"provider": "groq", "answer": ans}
        except Exception:
            pass
    return {"provider": "none", "answer": _simple_answer(df, question)}
