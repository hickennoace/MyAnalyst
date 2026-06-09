"""Currency detection + money formatting.

The engine used to hardcode `$`. This detects the dataset's actual currency from money-column headers
(ISO codes or symbols like "Revenue (EUR)" / "price_₪") and from the raw cell values ("€1.200", "₪500"),
then every money string the engine writes uses that symbol. Defaults to USD `$` when nothing is found, so
behaviour is unchanged for the common case.
"""
from __future__ import annotations

import re

import pandas as pd

# ISO code → display symbol. Symbols that collide on "$" (USD/CAD/AUD/MXN…) all render "$" — we keep the
# detected code in the spec for the UI, but the printed symbol is the familiar one.
ISO_TO_SYMBOL = {
    "USD": "$", "CAD": "$", "AUD": "$", "NZD": "$", "MXN": "$", "SGD": "$", "HKD": "$",
    "EUR": "€", "GBP": "£", "JPY": "¥", "CNY": "¥", "RMB": "¥",
    "ILS": "₪", "NIS": "₪", "INR": "₹", "KRW": "₩", "RUB": "₽", "TRY": "₺",
    "BRL": "R$", "ZAR": "R", "CHF": "CHF", "SEK": "kr", "NOK": "kr", "DKK": "kr", "PLN": "zł",
    "THB": "฿", "PHP": "₱", "VND": "₫", "NGN": "₦", "UAH": "₴", "AED": "AED", "SAR": "SAR",
}
# Multi-char symbols/codes are checked before single "$" so "R$" isn't read as "$" + "R".
_SYMBOLS = ["R$", "CHF", "kr", "zł", "€", "£", "¥", "₪", "₹", "₩", "₽", "₺", "฿", "₱", "₫", "₦", "₴", "$"]
_SYMBOL_TO_ISO = {
    "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₪": "ILS", "₹": "INR", "₩": "KRW",
    "₽": "RUB", "₺": "TRY", "R$": "BRL", "CHF": "CHF", "kr": "SEK", "zł": "PLN",
    "฿": "THB", "₱": "PHP", "₫": "VND", "₦": "NGN", "₴": "UAH",
}
_ISO_RE = re.compile(r"\b(" + "|".join(sorted(ISO_TO_SYMBOL, key=len, reverse=True)) + r")\b", re.I)

DEFAULT = {"symbol": "$", "code": "USD"}


def _from_text(text: str) -> dict | None:
    m = _ISO_RE.search(text)
    if m:
        code = m.group(1).upper()
        return {"symbol": ISO_TO_SYMBOL[code], "code": code}
    for sym in _SYMBOLS:
        if sym in text:
            return {"symbol": sym, "code": _SYMBOL_TO_ISO.get(sym, sym)}
    return None


def detect(df: pd.DataFrame, money_columns: list[str]) -> dict:
    """Detect from money-column headers first (most reliable), then their raw cell values; default USD."""
    header_hit = _from_text(" ".join(money_columns))
    if header_hit:
        return header_hit
    for col in money_columns:
        if col not in df.columns:
            continue
        sample = " ".join(df[col].dropna().astype(str).head(60).tolist())
        cell_hit = _from_text(sample)
        if cell_hit:
            return cell_hit
    return dict(DEFAULT)


def money(x: float, symbol: str = "$") -> str:
    """Compact money string with the dataset's symbol: $1.2M / €340K / ₪1,200."""
    a = abs(x)
    if a >= 1e6:
        return f"{symbol}{x/1e6:.1f}M"
    if a >= 1e3:
        return f"{symbol}{x/1e3:.0f}K"
    return f"{symbol}{x:,.0f}"
