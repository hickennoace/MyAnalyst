"""Celery worker orchestration of the 7-stage analysis pipeline.

A dataset job runs stages 1→7 (ingest → clean → profile → kpi → stats → insights →
assemble). Each stage:
    * is its own task (retryable, idempotent),
    * writes progress to Redis/DB so the API can stream it over SSE,
    * persists its artifact so the run is resumable and auditable.

Backpressure: per-tenant concurrency caps; autoscale workers on queue depth.

TODO: define celery_app, the per-stage tasks, and the chained run_pipeline(dataset_id).
"""

# from celery import Celery
# celery_app = Celery("quantia", broker=..., backend=...)
