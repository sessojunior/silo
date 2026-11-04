# SDD ledger — plan: docs/superpowers/plans/2026-11-04-ai-preferences-and-ncm-triage.md

Ruling: execute in the current checkout — the user explicitly approved Native execution and the checkout contains pre-existing user changes that must remain in place; creating a worktree would separate the approved documentation and unrelated working changes. Cost if wrong: this feature's commits share the current branch with unrelated changes and may require careful review before integration.

Pre-flight: Task 1 produces persisted user preference fields and API semantics consumed by Task 2's React context and Task 3's capability policy; Task 2 produces browser events consumed by the sidebar; Task 3 produces the authoritative policy consumed by Task 4's triage integration; Task 5 consumes all previous contracts. No conflicting interfaces found.

Task 1: Ruling: `uv run --locked pytest` cannot start because the Windows uv trampoline cannot canonicalize its script path; use the repository's existing `apps/backend/.venv/Scripts/python.exe -m pytest` for equivalent locked-environment test execution. Cost if wrong: command parity with CI must be checked separately, but test behavior remains the same interpreter/environment.

Task 1: complete (commit pending in current checkout, tests: `apps/backend/.venv/Scripts/python.exe -m pytest apps/backend/tests/unit/test_ai_preferences.py apps/backend/tests/unit/test_fixture_api_helpers.py apps/backend/tests/unit/test_sqlalchemy_models.py apps/backend/tests/unit/test_db_migrate.py -q` → 21 passed)

Task 2: complete (tests: focused frontend tests 5 passed; typecheck passed; full frontend suite 116 passed)
Task 3: complete (focused backend policy, route and service tests: 71 passed; settings and preference regression tests: 96 passed)
Task 4: complete (NCM contract, settings, fallback and observability tests: 88 passed)
Task 5: complete (integration: 2 passed; fixture/procedure/agentic integration: 5 passed; backend full suite: 687 passed, 6 skipped; frontend full suite: 116 passed; typecheck and lint passed)
