# ORM models

SQLAlchemy 2.0 models — the relational source of truth (metadata, NOT bulk data).

Planned tables (all tenant-scoped tables carry `tenant_id` + an RLS policy):

| Table | Purpose |
|-------|---------|
| `tenants` | one row per customer/org |
| `users`, `memberships` | identity + role (owner/admin/analyst/viewer) within a tenant |
| `datasets` | uploaded/connected data: source type, object-storage ref, status, version |
| `connections` | user SQL connections; credentials stored **envelope-encrypted** |
| `jobs` | pipeline runs: stage, progress, timings, errors |
| `dashboards` | the generated declarative spec (JSONB) + KPIs/insights refs |
| `audit_log` | append-only access/action trail (who, what, when, from where) |

Migrations via Alembic. Bulk data lives as Parquet in object storage, not here.
