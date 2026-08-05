# Evidência da Fase 6 — slice inicial de sistema

Data local: 2026-07-22  
Escopo executado: primeiro slice obrigatório da Fase 6: `server-time`, `check-admin`, health e warmup.

## Implementação

- Router sistêmico FastAPI: `apps/backend/src/silo/api/routers/system.py`.
- Registro no app: `apps/backend/src/silo/api/main.py`.
- Testes unitários: `apps/backend/tests/unit/test_system_routes.py`.
- Teste de integração PostgreSQL real: `apps/backend/tests/integration/test_system_postgres.py`.
- Contrato do slice: `tests/contracts/legacy/cases.phase-6.1-system.json`.
- OpenAPI regenerado em `packages/engine/src/contracts/generated/`.

## Contrato

Ambiente descartável usado:

- Banco: `silo_contract_phase6_1`.
- Seeds: `tests/fixtures/legacy-db/seed-contract-users.sql`.
- API Python: `http://127.0.0.1:4003`.
- Auth do runner: `SILO_CONTRACT_AUTH_MODE=static`.
- Ollama indisponível intencionalmente via `OLLAMA_URL=http://127.0.0.1:9` para validar o erro legado de warmup.

Casos capturados:

- `phase6_1.system.health.success`
- `phase6_1.system.server_time.success`
- `phase6_1.system.check_admin.unauthenticated`
- `phase6_1.system.check_admin.admin`
- `phase6_1.system.check_admin.no_permission`
- `phase6_1.system.warmup_ollama_unavailable`

Resultado: runner `tests/contracts/legacy/runner.mjs` concluído com exit code `0`.

## Comparação com goldens legados

Comparação status/body aprovada contra:

- `phase1_6.read.health.success.json`
- `phase1_6.read.server_time.success.json`
- `phase1_6.check_admin.unauthenticated.json`
- `phase1_6.check_admin.admin.json`
- `phase1_6.check_admin.no_permission.json`
- `phase1_6.infrastructure.system.warmup_ollama_unavailable.json`

Normalizações aplicadas: timestamps ISO e valores dinâmicos de latência.

## Banco e side effects

Contagens antes/depois idênticas para tabelas do slice:

```text
group|3
group_permissions|51
user|4
user_group|4
```

Arquivos:

- `contract/row-counts-before.txt`
- `contract/row-counts-after.txt`

## Gates executados

- `npm run py:format:check` — passou.
- `npm run py:lint` — passou.
- `npm run py:typecheck` — passou.
- `npm run py:test` — passou (`112 passed, 2 skipped`).
- `npm run py:openapi:check` — passou.
- `SILO_SYSTEM_INTEGRATION_DATABASE_URL=... uv --directory apps/backend run --locked pytest -q tests/integration/test_system_postgres.py` — passou (`1 passed`).
- `npm run typecheck` — passou.
- `npm run test:web` — passou (`22 passed`, `53 passed`).
- `npm run test:api` — passou (`9 passed`, `61 passed`).

Gate do slice inicial: aprovado. Gate 6 global permanece pendente até todos os slices da Fase 6 serem concluídos.
