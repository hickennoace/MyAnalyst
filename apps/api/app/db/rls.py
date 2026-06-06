"""Row-Level Security helpers — the heart of tenant isolation.

Every request runs inside a transaction that first executes:

    SET LOCAL app.tenant_id = '<uuid-from-verified-JWT>';

Postgres RLS policies then constrain every row to that tenant. The tenant id is
taken ONLY from the verified JWT claim — NEVER from a client-supplied request body.

The app connects as a role (DB_APP_ROLE) that does NOT have BYPASSRLS, so even a
forgotten ``WHERE tenant_id`` clause cannot leak cross-tenant data.

See docs/03-security-privacy.md §3 and the tenant-isolation test in tests/.
"""

# from contextlib import asynccontextmanager


# @asynccontextmanager
# async def tenant_session(tenant_id: str):
#     """Yield a DB session with app.tenant_id set for RLS. TODO: implement."""
#     raise NotImplementedError
