# 03 — Security & Privacy Strategy

> Goal: a platform users trust with their financials. "100% safe" is a posture, not a checkbox — it's defense-in-depth across identity, data, network, application, and operations, plus the discipline to prove it.

> ⚠️ Reality check: no system is literally unbreakable. What follows is how you get to *bank-grade* assurance and shrink the blast radius of any single failure to near zero.

---

## 1. Trust boundary (the most important diagram)

```
        UNTRUSTED                 │            TRUSTED (our control)
─────────────────────────────────┼──────────────────────────────────────────
  Browser, user network          │   API gateway → FastAPI → workers → Postgres → object storage
                                  │
  External LLM provider          │◄── crosses boundary with METADATA + AGGREGATES ONLY
                                  │      (never raw rows, never PII)
```
Every design decision below either hardens this boundary or limits what spills if it's crossed.

## 2. Identity & authentication (the "bulletproof login")

- **Managed auth provider** for MVP: **Supabase Auth** or **Clerk** / **Auth0**. Don't hand-roll password storage. (If self-hosting later: Argon2id hashing, never reversible.)
- **MFA / TOTP** available, enforced for admin and optionally per-tenant policy.
- **Sessions**: short-lived access tokens (JWT, ~15 min) + rotating refresh tokens stored in **HttpOnly, Secure, SameSite=Strict** cookies. No tokens in `localStorage`.
- **Password policy**: length-first (12+), breached-password check (HaveIBeenPwned k-anonymity API), rate-limited + lockout/backoff on failed attempts.
- **OAuth/SSO** (Google, Microsoft) + **SAML/OIDC** for enterprise tenants later.
- **RBAC**: roles `owner / admin / analyst / viewer` per tenant; permissions checked at the API on every request, never trusted from the client.
- **Email verification** + secure password reset (single-use, expiring, signed tokens).

## 3. Multi-tenant isolation (Row-Level Security)

This is how user environments are truly separated.

- Every tenant-scoped table carries `tenant_id`.
- **Postgres RLS policies** enforce `tenant_id = current_setting('app.tenant_id')::uuid` on every row, for SELECT/INSERT/UPDATE/DELETE.
- The app connects as a **non-superuser role that cannot bypass RLS**, and sets `SET LOCAL app.tenant_id = '<uuid>'` at the start of each request/transaction from the verified JWT claim — *never* from a client-supplied body field.
- **Object storage**: per-tenant key prefixes (`tenant/<id>/...`) + scoped, short-TTL presigned URLs. No tenant can mint a URL for another's prefix.
- **Defense in depth**: even if application code forgets a `WHERE tenant_id`, RLS still blocks cross-tenant reads. Add automated tests that assert tenant A cannot read tenant B.

## 4. Encryption

| Layer | Mechanism |
|-------|-----------|
| In transit (public) | **TLS 1.3** everywhere; HSTS preload; modern cipher suites only. |
| In transit (internal) | mTLS between services / private network; LLM calls over TLS to a zero-retention endpoint. |
| At rest (DB) | Postgres storage encryption (managed provider KMS) + column-level encryption for the most sensitive fields. |
| At rest (objects) | SSE-KMS on the bucket; per-tenant data keys (envelope encryption) so a single key compromise isn't global. |
| Secrets | Doppler / cloud secret manager; never in repo or plain env in prod. **Key rotation** scheduled. |
| Field-level | App-side encryption (e.g. via `cryptography`/libsodium) for DB connection strings users give us — see §6. |

## 5. The privacy linchpin — raw data never leaves

- The **only** path to the external LLM is `apps/api/.../insights/llm_client.py`. It accepts a typed `InsightContext` (domain, KPI values, regression summaries, anomaly markers) — a schema that **cannot represent raw rows or PII**.
- A **redaction/aggregation gate** sits in front of it: column names can be pseudonymized; only aggregates pass.
- **Zero-retention agreement** with the LLM provider (no training, no storage). Document it.
- Optional **fully self-hosted** mode (vLLM + open model) for customers who require that nothing leaves at all.
- **PII detection** during profiling flags columns (emails, SSNs, card numbers) → masked in previews, excluded from any LLM context, encrypted at rest.

## 6. Handling user SQL connections safely

- Connection credentials encrypted at rest with a per-tenant data key (envelope encryption); decrypted only in-worker, in-memory, for the duration of a pull.
- **Read-only** enforced: we request least-privilege; queries run with statement timeouts and row caps.
- Outbound connections from an **egress-controlled** worker subnet; allowlist destinations; block access to internal/metadata IPs (**SSRF protection** — deny `169.254.169.254`, RFC1918, etc.).
- Never echo credentials back to the client.

## 7. Application security (OWASP Top 10 discipline)

- **Input validation** everywhere via Pydantic; reject unexpected fields.
- **File upload safety**: validate type/size, parse in a sandboxed worker, never `eval`/`pickle` untrusted input, cap rows/cells, scan for formula-injection in spreadsheets (CSV/Excel `=`, `+`, `-`, `@` lead cells).
- **SQL injection**: parameterized queries / SQLAlchemy only; user SQL (for their own connection) is read-only and sandboxed.
- **XSS/CSRF**: React auto-escaping, strict **Content-Security-Policy**, SameSite cookies, CSRF tokens for state-changing form posts.
- **SSRF**: egress allowlist (see §6).
- **Rate limiting & quotas** per IP and per tenant at the gateway; upload size/row caps.
- **Dependency security**: `pip-audit`, `npm audit`, **Dependabot/Renovate**, pinned lockfiles, SBOM.
- **Secrets scanning** (gitleaks) in CI; pre-commit hooks.

## 8. Network & infrastructure hardening

- **WAF** + DDoS protection at the edge (Cloudflare / provider WAF).
- Private networking: DB, Redis, and object storage **not publicly reachable**; only the API/workers in the VPC reach them.
- **Least-privilege IAM** for every service; no shared "god" credentials.
- Bastion-less ops (SSM/identity-aware proxy); no open SSH.
- **Immutable, minimal container images** (distroless where possible); non-root; read-only filesystems; pinned digests.
- Regular **patching** + automated image rebuilds on CVE.

## 9. Auditing, monitoring, incident response

- **Append-only audit log**: who accessed which dataset/dashboard, when, from where. Tamper-evident.
- **Anomaly alerts**: impossible-travel logins, spikes in export volume, repeated authz failures.
- **Centralized logging** with PII scrubbing; **traces** across tiers (OpenTelemetry).
- **Incident response runbook**: detection → contain → eradicate → recover → post-mortem; breach-notification SLAs.
- **Backups**: encrypted, tested restores, point-in-time recovery; backups also tenant-scoped.

## 10. Data lifecycle & compliance

- **Data residency** options; **retention policies** + hard delete on tenant request (right to erasure).
- **GDPR / CCPA** alignment: data inventory, DPA with subprocessors (incl. LLM provider), export-my-data + delete-my-data flows.
- **SOC 2 Type II** as the north-star certification (drives the controls above). Map each control to evidence.
- **DPIA** for the LLM data flow documenting exactly what aggregates cross the boundary.

## 11. Verification — prove it, don't assume it

- Automated **tenant-isolation tests** (A cannot read B) in CI.
- **SAST** (Bandit, Semgrep, CodeQL) + **DAST** on staging.
- Periodic **third-party penetration tests** + a responsible-disclosure / bug-bounty program.
- **Threat model** kept current (STRIDE per component).

## 12. Security checklist (build-time gate)

- [ ] All traffic TLS 1.3 + HSTS
- [ ] RLS enabled on every tenant table + isolation test passing
- [ ] App DB role cannot bypass RLS; `tenant_id` set from JWT only
- [ ] Object storage private + per-tenant prefixes + short-TTL presigned URLs
- [ ] Secrets in a manager, rotation scheduled, gitleaks in CI
- [ ] LLM adapter is the only egress path; metadata-only schema enforced; zero-retention signed
- [ ] PII detection + masking in profiling
- [ ] SSRF egress allowlist for user SQL connections
- [ ] MFA available; sessions HttpOnly/Secure/SameSite; lockout/backoff
- [ ] CSP, CSRF, formula-injection guards
- [ ] Dependency + container scanning in CI
- [ ] Audit log append-only; alerts on anomalies
- [ ] Encrypted, tested backups with PITR
