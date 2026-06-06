# scripts

Dev & ops helper scripts (scaffold). Planned:

- `dev.sh` / `dev.ps1` — bring up docker-compose + run web & api with reload.
- `seed.py` — load a curated sample financial dataset for onboarding/demo.
- `check_tenant_isolation.py` — quick manual check that tenant A cannot read tenant B
  (the automated version lives in apps/api/tests).
- `gen-types.*` — regenerate TS types from the shared JSON schemas.
