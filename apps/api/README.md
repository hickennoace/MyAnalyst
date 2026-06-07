# MyAnalyst API & Compute Tier (FastAPI + Python workers)

Async API tier + the heavy data-science compute tier. Same codebase; the API enqueues jobs, workers run the analysis pipeline.

## Layout
```
app/
├── main.py            # FastAPI app factory, middleware, router mounting
├── core/              # config, logging, security/JWT, dependencies
├── db/                # SQLAlchemy session, RLS tenant-context helpers
├── models/            # ORM models (tenants, users, datasets, jobs, dashboards, audit)
├── schemas/           # Pydantic request/response + the InsightContext contract
├── api/routes/        # REST endpoints: auth, datasets, connections, jobs, dashboards
├── ingestion/         # stage 1 — parse CSV/Excel/JSON/SQL → Parquet
├── cleaning/          # stage 2 — type/normalize/dedupe/impute + cleaning report
├── profiling/         # stage 3 — column profiles + domain detection
├── kpi_engine/        # stage 4 — domain-keyed KPI rules (financial first)
├── stats_engine/      # stage 5 — regression / correlation / forecast / anomaly
├── insights/          # stage 6 — llm_client (metadata-only) + grounding guard
├── dashboard/         # stage 7 — assemble declarative dashboard spec
└── workers/           # Celery app + pipeline task orchestration
tests/                 # incl. tenant-isolation tests (A cannot read B)
```

## Pipeline = 7 stages
See [../../docs/01-architecture.md](../../docs/01-architecture.md) §4. Each stage is a worker task; artifacts are persisted so runs are resumable and auditable.

## Privacy invariant
`insights/llm_client.py` is the **only** outbound LLM path and accepts only the metadata-only `InsightContext`. Raw rows never reach it.

## Dev
```bash
# from repo root
docker compose up        # postgres + redis + minio + api + worker
uvicorn app.main:app --reload   # standalone API
celery -A app.workers.celery_app worker -l info   # standalone worker
```

> ⚠️ Scaffold only — modules contain docstrings and TODOs, not implementations.
