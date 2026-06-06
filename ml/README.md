# ML & prompts

Experiment notebooks, model artifacts, and LLM prompt templates that feed the compute tier.

```
ml/
├── notebooks/      # experiments (e.g. port & validate KPI/stat code from the ETH notebook)
├── prompts/        # versioned LLM prompt templates for insight generation & domain classify
└── models/         # serialized artifacts (gitignored; tracked via a registry/DVC later)
```

## Reuse note
The sibling `JupyterProject/main.ipynb` already validates the financial metric & stat
methods (CAGR, Sharpe/Sortino/Calmar, rolling correlation + significance, OLS, drawdown).
Use `notebooks/` to port these into the `kpi_engine` / `stats_engine` packages with tests.

## Prompt discipline
Prompts here operate on the **metadata-only InsightContext** — never raw rows. Version
them; track which prompt produced which insight for auditability.
