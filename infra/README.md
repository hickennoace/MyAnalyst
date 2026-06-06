# Infrastructure

Local dev + deployment infra. Scaffold only — no live infra defined yet.

## Local (`docker-compose.yml`)
One command brings up the full stack for development:
- **postgres** (with RLS) · **redis** (broker/cache) · **minio** (S3-compatible storage)
- **api** (FastAPI) · **worker** (Celery) · **web** (Next.js)

## Cloud (planned)
- **MVP**: Vercel (web) + Fly.io/Render/Railway (api + workers) + managed Postgres
  (Supabase/Neon) + R2/S3 (storage) + managed Redis.
- **Scale**: Kubernetes for worker autoscaling on queue depth; Terraform in `terraform/`.

## Hardening (see docs/03-security-privacy.md §8)
WAF/DDoS at the edge · private networking for DB/Redis/storage · least-privilege IAM ·
minimal non-root immutable images · pinned digests · egress allowlist for user SQL pulls.
