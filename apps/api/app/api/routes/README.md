# API routes

REST endpoints (FastAPI routers). Auth enforced on every tenant-scoped route; authz
checked server-side, never trusted from the client.

| Router | Endpoints (planned) |
|--------|---------------------|
| `auth` | register, login, verify-email, reset-password, mfa, refresh, me |
| `datasets` | request presigned upload, create dataset, list, get, delete, versions |
| `connections` | create/test/list SQL connections (creds envelope-encrypted), trigger pull |
| `jobs` | get job status, `GET /jobs/{id}/stream` (SSE progress) |
| `dashboards` | get dashboard spec, list, export (pdf/png), share link |

All heavy work is **enqueued** here, not executed inline.
