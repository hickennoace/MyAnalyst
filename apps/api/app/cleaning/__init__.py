"""Stage 2 — Cleaning & normalization (the moat).

Turn a messy real-world frame into a trustworthy one, and emit a transparent
CLEANING REPORT describing every change so the user can trust the output.

Handles: type inference, date parsing (mixed formats), currency/number normalization
         (symbols, thousands separators, locale), dedupe, missing-value handling,
         merged-header / trailing-total row detection, casing/whitespace, outlier flagging.

Validation gate: pandera schema asserts the cleaned frame meets expectations before
                 it flows downstream.

TODO: implement cleaners as composable steps, each appending to the cleaning report.
"""
