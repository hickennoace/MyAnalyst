"""Stage 7 — Dashboard assembler.

Combine KPIs + statistical results + insight narratives into a single DECLARATIVE
dashboard spec (JSON). The frontend renders this spec; the backend owns its shape.

The spec schema lives in packages/shared so web & api agree on the contract. It
describes: KPI cards, chart blocks (type + data ref + encodings), narrative/insight
blocks, and layout. Persisted as JSONB on the `dashboards` table; versioned per run.

TODO: implement assemble(profile, kpis, stats, insights) -> DashboardSpec.
"""
