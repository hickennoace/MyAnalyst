"""Tenant-isolation test — the security gate that MUST pass before anything ships.

Asserts that, with Postgres RLS active and the app DB role unable to bypass it,
tenant A can never read, update, or delete tenant B's rows — even if application
code forgets a `WHERE tenant_id` clause.

See docs/03-security-privacy.md §3 and apps/api/app/db/rls.py.
"""

import pytest


@pytest.mark.skip(reason="Scaffold — implement once auth/RLS land (MVP Phase 1).")
def test_tenant_a_cannot_read_tenant_b():
    # 1. create tenant A + tenant B, each with a dataset
    # 2. open a session with app.tenant_id = A
    # 3. attempt to SELECT tenant B's dataset -> expect 0 rows (RLS blocks it)
    # 4. repeat for UPDATE / DELETE
    raise NotImplementedError
