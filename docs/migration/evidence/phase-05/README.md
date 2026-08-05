# Evidência da Fase 5 — autenticação, sessões e permissões

Data local: 2026-07-22  
Escopo executado: Fase 5 da migração.

## Implementação

- Auth FastAPI adicionado em `apps/backend/src/silo/auth/` e `apps/backend/src/silo/api/routers/auth.py`.
- Sessões passam a emitir cookie opaco `silo_session`, mantendo leitura e limpeza de cookies Better Auth durante rollback.
- Web alterado de forma compatível em `apps/frontend/src/proxy.ts` e no fluxo de `setup-password`.
- Vetores compartilhados de validação em `tests/fixtures/auth-validation-vectors.json`, executados em Python e TypeScript.
- Comunicação de cutover documentada em `docs/migration/auth-cutover.md`.
- `AUTH_DEV_LOG_OTP=false` documentado em `env.example`.
- Correção aplicada em `apps/backend/src/silo/config.py`: `Settings` não lê variáveis de ambiente duas vezes; `load_settings()` continua sendo o parser explícito e determinístico. Isso permite `CORS_ORIGINS` e `ALLOWED_EMAIL_DOMAINS` em CSV no boot real.

## Contrato auth/cookies

Ambiente descartável usado:

- Banco: `silo_contract_phase5`.
- Migrations: `apps/backend/.venv/Scripts/alembic.exe upgrade head`.
- Seeds:
  - `tests/fixtures/legacy-db/seed-contract-users.sql`
  - `tests/fixtures/legacy-db/seed-contract-auth-flows.sql`
- API Python: `http://127.0.0.1:4002`.
- Casos: `tests/contracts/legacy/cases.phase-1.8-auth-cookies.json`.
- Runner: `node tests/contracts/legacy/runner.mjs`.

Resultado: runner concluído com exit code `0` e 13 capturas aprovadas em:

- `docs/migration/evidence/phase-05/auth-contract/20260722-195718/goldens/`

Observação de normalização: token de sessão, id de sessão, timestamps, content-length e valor do cookie são dinâmicos por execução. A mudança semântica planejada é o nome do cookie de sessão: `silo_session`.

## Gates executados

- `npm run py:format:check` — passou (`60 files already formatted`).
- `npm run py:lint` — passou (`All checks passed`).
- `npm run py:typecheck` — passou (`Success: no issues found in 31 source files`).
- `npm run py:test` — passou (`106 passed, 1 skipped`).
- `npm run py:openapi:check` — passou.
- `npm run typecheck` — passou para web, api e worker.
- `npm run test:api` — passou (`9 passed`, `61 passed`).
- `npm run test:web` — passou (`22 passed`, `53 passed`).

## Gates da Fase 5

- Auth goldens: aprovados pelo runner `phase-1.8-auth-cookies`; exceção planejada: cookie `silo_session`.
- Usuários/hashes existentes autenticam: coberto por vetores bcrypt em Python e login de seed no contrato.
- CSRF em endpoints mutáveis: coberto por `apps/backend/tests/unit/test_auth_csrf.py` dentro de `npm run py:test`.
- Frontend dual-cookie: coberto por `apps/frontend/src/proxy.ts`, `npm run typecheck` e `npm run test:web`.
