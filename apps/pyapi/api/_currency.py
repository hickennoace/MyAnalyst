"""Currency detection + money formatting.

Detects the dataset's currency from money-column headers (ISO codes, symbols, or the currency's NAME —
"Revenue (EUR)", "price_₪", "Salary in Shekels") and from raw cell values ("€1.200", "₪500", "¥1,200"),
covering ~50 world currencies. Defaults to USD `$` when nothing is found, so behaviour is unchanged for the
common case. The engine displays money in the detected currency — it does not convert between currencies.
"""
from __future__ import annotations

import re

import pandas as pd

# Canonical ISO code → display symbol. Codes that share a glyph (the many "$" currencies, JPY/CNY on ¥)
# keep their own code so the UI can still say which one — the printed glyph is just the familiar one.
CODE_TO_SYMBOL = {
    "USD": "$", "CAD": "$", "AUD": "$", "NZD": "$", "HKD": "$", "SGD": "$", "MXN": "$",
    "CLP": "$", "COP": "$", "ARS": "$", "TWD": "NT$",
    "EUR": "€", "GBP": "£", "JPY": "¥", "CNY": "¥", "RMB": "¥",
    "ILS": "₪", "NIS": "₪", "INR": "₹", "KRW": "₩", "RUB": "₽", "TRY": "₺", "THB": "฿", "PHP": "₱",
    "VND": "₫", "NGN": "₦", "UAH": "₴", "GHS": "₵", "PYG": "₲", "KZT": "₸", "GEL": "₾", "CRC": "₡",
    "BRL": "R$", "ZAR": "R", "EGP": "E£",
    "CHF": "CHF", "SEK": "kr", "NOK": "kr", "DKK": "kr", "ISK": "kr",
    "PLN": "zł", "CZK": "Kč", "HUF": "Ft", "RON": "lei", "BGN": "лв", "HRK": "kn",
    "AED": "AED", "SAR": "SAR", "QAR": "QAR", "KWD": "KWD", "BHD": "BHD", "OMR": "OMR", "JOD": "JOD",
    "IDR": "Rp", "MYR": "RM", "PKR": "₨", "LKR": "₨", "NPR": "₨", "BDT": "৳",
    "KES": "KSh", "MAD": "MAD", "TND": "TND",
}
# NIS is the old code for ILS, RMB the informal one for CNY — normalize so the spec is canonical.
_NORMALIZE = {"NIS": "ILS", "RMB": "CNY"}

# True glyph symbols, longest first so "R$"/"NT$"/"E£" beat "$"/"£". Each maps to a sensible default code
# for the symbol-only case (an ISO code or name in the header overrides it).
_GLYPHS = ["R$", "NT$", "E£", "€", "£", "¥", "₪", "₹", "₩", "₽", "₺", "฿", "₱", "₫", "₦", "₴", "₵", "₲", "₸", "₾", "₡", "$"]
_GLYPH_TO_CODE = {
    "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₪": "ILS", "₹": "INR", "₩": "KRW", "₽": "RUB",
    "₺": "TRY", "฿": "THB", "₱": "PHP", "₫": "VND", "₦": "NGN", "₴": "UAH", "₵": "GHS", "₲": "PYG",
    "₸": "KZT", "₾": "GEL", "₡": "CRC", "R$": "BRL", "NT$": "TWD", "E£": "EGP",
}
# Distinctive currency NAMES (word-boundary matched). Curated to avoid English-word collisions — no bare
# "pound"/"won"/"real"/"peso"/"krona" (too ambiguous).
_WORD_TO_CODE = {
    "dollar": "USD", "dollars": "USD", "euro": "EUR", "euros": "EUR", "sterling": "GBP",
    "yen": "JPY", "yuan": "CNY", "renminbi": "CNY", "shekel": "ILS", "shekels": "ILS", "shekalim": "ILS",
    "rupee": "INR", "rupees": "INR", "ruble": "RUB", "rubles": "RUB", "rouble": "RUB", "roubles": "RUB",
    "lira": "TRY", "zloty": "PLN", "baht": "THB", "ringgit": "MYR", "rupiah": "IDR", "dirham": "AED",
    "riyal": "SAR", "rial": "SAR", "forint": "HUF", "koruna": "CZK", "reais": "BRL", "franc": "CHF",
    "francs": "CHF", "hryvnia": "UAH", "naira": "NGN", "taka": "BDT", "dong": "VND", "rand": "ZAR",
}

_ISO_RE = re.compile(r"\b(" + "|".join(sorted(CODE_TO_SYMBOL, key=len, reverse=True)) + r")\b", re.I)
_WORD_RE = re.compile(r"\b(" + "|".join(sorted(_WORD_TO_CODE, key=len, reverse=True)) + r")\b", re.I)

DEFAULT = {"symbol": "$", "code": "USD"}


def _as_currency(code: str) -> dict:
    code = _NORMALIZE.get(code, code)
    return {"symbol": CODE_TO_SYMBOL.get(code, "$"), "code": code}


def _from_text(text: str) -> dict | None:
    # ISO code is the most specific; then the currency's NAME; then a bare glyph.
    m = _ISO_RE.search(text)
    if m:
        return _as_currency(m.group(1).upper())
    w = _WORD_RE.search(text)
    if w:
        return _as_currency(_WORD_TO_CODE[w.group(1).lower()])
    for sym in _GLYPHS:
        if sym in text:
            return _as_currency(_GLYPH_TO_CODE[sym])
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
        # In cell values only trust GLYPHS (letter codes like "RM"/"kr" collide with ordinary text).
        for sym in _GLYPHS:
            if sym in sample:
                return _as_currency(_GLYPH_TO_CODE[sym])
    return dict(DEFAULT)


def money(x: float, symbol: str = "$") -> str:
    """Compact money string with the dataset's symbol: $1.2M / €340K / ₪1,200 / ¥50K."""
    a = abs(x)
    if a >= 1e6:
        return f"{symbol}{x/1e6:.1f}M"
    if a >= 1e3:
        return f"{symbol}{x/1e3:.0f}K"
    return f"{symbol}{x:,.0f}"
