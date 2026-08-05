# Phase 7 gate summary

Scope covered here:

- scheduling / availability / conflicts / shift-turn handling
- projects and project activities
- project tasks, reorder, users and history
- product activities, availability exceptions and history
- product contacts / dependencies / manual
- problems / categories / images / solutions / checks
- dashboard aggregations
- report data services and report PDFs
- model-run status semantics used by dashboard/reporting logic

Validation performed:

1. FastAPI route-structure smoke check against the Python app.
   - Result: every phase-7 path matched a registered route, including:
     - `/api/projects`
     - `/api/projects/:projectId/activities`
     - `/api/projects/:projectId/activities/:activityId/tasks`
     - `/api/tasks/:taskId/history`
     - `/api/tasks/:taskId/users`
     - `/api/products/activities/availability`
     - `/api/products/activities/pending-email`
     - `/api/products/availability-exceptions`
     - `/api/products/contacts`
     - `/api/products/dependencies`
     - `/api/products/dependencies/reorder`
     - `/api/products/manual`
     - `/api/products/manual/images`
     - `/api/products/problems`
     - `/api/products/problems/categories`
     - `/api/products/images`
     - `/api/products/solutions`
     - `/api/products/solutions/count`
     - `/api/products/solutions/summary`
     - `/api/products/solutions/images`
     - `/api/products/:productId/history`
     - `/api/products/:productId/data-flow`
     - `/api/dashboard`
     - `/api/dashboard/summary`
     - `/api/dashboard/problems-causes`
     - `/api/dashboard/problems-solutions`
     - `/api/dashboard/projects`
     - `/api/reports/availability`
     - `/api/reports/availability/pdf`
     - `/api/reports/problems`
     - `/api/reports/problems/pdf`
     - `/api/reports/executive`
     - `/api/reports/executive/pdf`
     - `/api/reports/projects`
     - `/api/reports/projects/pdf`
     - `/api/reports/files`

2. Backend unit suite relevant to the migrated application layer.
   - Command: `apps/backend/.venv/Scripts/python.exe -m pytest -q tests/unit`
   - Result: `112 passed, 1 skipped`

3. Real Postgres smoke validation on an ephemeral Docker container seeded from the Python seed command.
   - Seed command:
     - `DATABASE_URL=postgresql://silo:silo@127.0.0.1:<ephemeral-port>/silo`
     - `python -m silo.db.migrate`
     - `python -m silo.db.seed`
   - Final validation result: `phase7-final-ok`
   - Verified outcomes:
     - `get_problems_report` returned `resolvedCount=1` and `resolutionRate=50`.
     - `topProblems` ordering was stable: newest problem first, then older problem.
     - `get_executive_report(..., group_id=...)` rejected the unsupported filter with `UNSUPPORTED_FILTER`.
     - `reorder_project_activity_tasks` updated task order and wrote history.
     - `get_task_history` returned at least one history row.
     - `set_task_users` and `get_task_users` produced two assigned users.
     - `get_dashboard_summary` counted the inserted incident activity rows as expected.
     - `get_dashboard_projects` and `get_projects_report` both reflected the inserted project at 50% progress.
     - `EXPLAIN (ANALYZE, BUFFERS)` was captured for representative `product_activity` and `product_problem` aggregations.

4. Report/dashboard behavior checks encoded in the codebase.
   - `ModelRunStatusSemantics` is centralized in Python for the dashboard/reporting semantics.
   - Dashboard and report aggregations now run against the same Python service layer used by the routers.

Notes:

- The phase-7 routes are implemented in thin routers over the Python service layer.
- Frontend typecheck, test and production build also passed after the backend/frontend layout move, so the consumed contracts remain compatible.
