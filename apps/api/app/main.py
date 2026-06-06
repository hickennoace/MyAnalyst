"""Quantia API — FastAPI application factory.

Responsibilities (scaffold; not yet implemented):
    * build the app, configure middleware (CORS, security headers, request id),
    * mount routers from ``app.api.routes`` (auth, datasets, connections, jobs, dashboards),
    * wire structured logging + OpenTelemetry + Sentry,
    * expose /health and /ready.

The API is THIN: it validates, enforces authz, reads/writes metadata, and ENQUEUES
heavy work onto the Celery queue. It never runs a regression inline.
"""

# from fastapi import FastAPI
# from app.core.config import settings
# from app.api.routes import auth, datasets, connections, jobs, dashboards


def create_app():  # -> FastAPI
    """Application factory. TODO: implement."""
    raise NotImplementedError("Scaffold only — see docs/04-mvp-roadmap.md Phase 0.")


# app = create_app()
