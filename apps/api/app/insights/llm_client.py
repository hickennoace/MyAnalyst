"""Stage 6 — AI insight generation. THE ONLY OUTBOUND LLM PATH.

Privacy invariant (enforced here, in exactly one place):
    The LLM receives ONLY an `InsightContext` — domain label, KPI values, regression
    summaries, top correlations, anomaly markers. This schema CANNOT represent raw
    rows or PII. A redaction/aggregation gate runs before every call.

The LLM is a WRITER, not a CALCULATOR. It turns the numbers the local engine computed
into ranked, actionable, plain-language conclusions. It must never invent numbers.

Controls:
    * provider-abstracted (Anthropic now; vLLM/self-hosted later) — swap behind this adapter,
    * zero-retention provider config required in production,
    * structured output (JSON schema / tool mode) → validated InsightObject list,
    * GROUNDING GUARD: reject any insight that cites a number not present in the context.

See docs/03-security-privacy.md §5.
"""

# from app.schemas.insights import InsightContext, InsightObject


# class LLMClient:
#     async def generate_insights(self, ctx: "InsightContext") -> "list[InsightObject]":
#         """Redact -> call provider (structured) -> ground-check -> return. TODO."""
#         raise NotImplementedError
