"""Stage 3 — Schema profiling & domain detection.

Profile each column (dtype, cardinality, distribution, null rate, sample stats,
semantic role guess, PII flag) and infer the dataset's DOMAIN.

Domain (financial / sales-operational / marketing / survey / ...) drives which KPI
rules (stage 4) and statistical tools (stage 5) apply.

Domain detection = profile features + a metadata-only LLM classification (column
names/types/aggregates only — never raw rows).

PII flagged here is masked in previews and EXCLUDED from any LLM context downstream.

TODO: implement ColumnProfile + DatasetProfile dataclasses and detect_domain().
"""
