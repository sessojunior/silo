# Project validation repair plan

**Goal:** Reproduce and repair the six issues confirmed in the project audit, keeping validation gates enabled.

**Scope:** Existing Python/FastAPI backend, Next.js frontend, GitLab CI and Docker Compose. The user authorized rechecking and correcting the audit findings. Work stays on `fix/project-validation`, without deploying or modifying application data.

## Tasks

- [ ] Reproduce frontend test, Ruff, mypy and OpenAPI failures.
- [ ] Add regression tests for structured data-flow lists: preserve task timestamps, retain empty groups, flatten lists of pipeline files, and keep descending date/turn ordering. Correct parser discriminators and narrowing.
- [ ] Restore the missing frontend visualization fixtures or replace the stale external fixture dependency with explicit equivalent test data. Keep hostile-content and rendering assertions.
- [ ] Install development dependencies in CI and use the Docker embedding service address in deployment configuration. Verify resolved Compose configuration.
- [ ] Correct Python lint and type errors in independent areas: services, API routers, AI, and supporting modules. Keep strict mypy and existing Ruff rules; use documented framework configuration for FastAPI dependency defaults. Preserve runtime semantics, add tests when behavior changes.
- [ ] Regenerate OpenAPI from the corrected routes and check generated files.
- [ ] Run backend tests with coverage, coverage thresholds, frontend tests/lint/typecheck/build, Python lint/format/typecheck, OpenAPI check, dependency audits and local HTTP smoke checks.
- [ ] Review the diff for regressions, disabled gates and unrelated edits; report results and any remaining limits.

## Execution decisions

- Independent Python directories may be delegated using the parallel-agent skill. Each worker owns its assigned files; the coordinating agent owns shared configuration, tests, data-flow, frontend, CI and generated artifacts.
- Apply safe formatting/import fixes before delegation to avoid concurrent edits.
- Do not skip failing tests, relax strict type checking, or blanket-ignore lint errors to obtain a passing result.
- Validate configuration changes with their consumers; add regression tests for functional behavior rather than tests that merely mirror config text.
