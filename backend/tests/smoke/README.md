# Smoke Walker — walk_all_flows.py

End-to-end HTTP CRUD walk that hits every major API endpoint as an authenticated
user and verifies FK cascade behavior through the actual HTTP stack.

## Purpose

- Sanity-check a running backend instance (not a substitute for pytest)
- Verify that `DELETE /api/workloads/{id}` cascades to scenarios + experiments
- Catch 401/403 regressions on protected routes

## Prerequisites

- Backend stack running (`docker compose up` or `uvicorn app.main:app`)
- Demo user seeded: `demo_user / demo1234`
- For cascade steps to pass: DB must be rebuilt with FK schema
  (`python scripts/rebuild_db_with_fk.py --confirm`)

## Run

```bash
# Default (localhost:8000, demo_user / demo1234)
python backend/tests/smoke/walk_all_flows.py

# Custom host / credentials
python backend/tests/smoke/walk_all_flows.py \
    --base-url http://localhost:8000 \
    --user demo_user \
    --password demo1234

# Keep created entities after run (for manual inspection)
python backend/tests/smoke/walk_all_flows.py --keep
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | All steps passed |
| 1 | One or more steps failed |

## Coverage

Auth login, workload CRUD, platform CRUD, strategy CRUD + content,
scenario CRUD, experiment CRUD, cascade delete chain (workload→scenario→experiment),
negative auth (no token, bad token).

## When to use this vs pytest

| Tool | Use for |
|------|---------|
| `pytest backend/tests` | Unit + integration with in-memory SQLite |
| `walk_all_flows.py` | Running stack end-to-end, post-deploy smoke |
