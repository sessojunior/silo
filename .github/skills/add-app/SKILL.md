---
name: add-app
description: "Create a new app in the SILO monorepo under apps/. Use when scaffolding a new Next.js frontend, FastAPI backend, Python worker component, or a legacy migration oracle."
argument-hint: "App name and type (e.g. analytics-web nextjs, api-python fastapi, worker-python python)"
---

# Add App - SILO Monorepo

## When to Use

- Adding a new frontend (Next.js App Router)
- Adding a new backend capability in the Python app
- Adding a new worker module inside the Python backend
- Adding or extending a legacy oracle only when the migration plan asks for it

## Procedure

### 1. Choose the app type

| Type | Base template | Example |
|---|---|---|
| Next.js frontend | `apps/frontend` structure | `apps/analytics-web/` |
| FastAPI backend | `apps/backend` structure | `apps/backend/` |
| Python worker module | `apps/backend/src/silo/worker/` | `apps/backend/src/silo/worker/handlers/` |

### 2. Create the app folder and core files

Create `apps/<name>/` with the matching package/config layout for the target stack.

### 3. package.json template

If the new app is JavaScript/TypeScript, mirror the current workspace conventions.
If it is Python, follow the backend layout under `apps/backend/`.

### 4. Config

- Frontend validates env vars in `apps/frontend/src/lib/config.ts`.
- Backend validates env vars in `apps/backend/src/silo/config.py`.
- Never read environment variables directly from shared packages.

### 5. Register workspace scripts

Expose repo-level scripts only when they are actually needed by the root workflow.

### 6. Verify

```bash
npm run typecheck
npm run build
npm run py:test
```

## Key Constraints

- Apps may import from shared packages, but never from other apps.
- `apps/frontend` must not access the database directly.
- Backend and worker Python code stay inside `apps/backend`.
- Legacy Node oracles stay untouched unless the plan explicitly requires them.
