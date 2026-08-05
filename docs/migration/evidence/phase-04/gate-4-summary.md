# Gate 4 — camada de compatibilidade HTTP

Data: 2026-07-22

## Implementação

- Middlewares FastAPI/Starlette adicionados em `apps/backend/src/silo/api/middleware.py`:
  request id, duração, logging, trusted proxy, body limit JSON e rate limit global.
- Rate limit persistente de auth adicionado em `apps/backend/src/silo/api/rate_limit.py`:
  mesma chave `(email, ip, route)`, limpeza de registros antigos e UPSERT PostgreSQL atômico.
- Exceções e handlers adicionados em `apps/backend/src/silo/api/errors.py`,
  `apps/backend/src/silo/api/handlers.py` e `apps/backend/src/silo/api/responses.py`.
- Schemas base camelCase adicionados em `apps/backend/src/silo/api/schemas.py`.
- Dependências centralizadas de DB/autorização adicionadas em
  `apps/backend/src/silo/api/dependencies.py`.
- `/docs`, `/redoc` e `/openapi.json` ficam desabilitados quando `SILO_ENV=production`.
- Exportador OpenAPI adicionado em `apps/backend/src/silo/api/openapi_export.py`.
- Artefatos gerados em `packages/engine/src/contracts/generated/`.
- CI atualizado para `npm run py:openapi:check`.

## Gates executados

```text
npm run py:format:check
Resultado: 47 files already formatted

npm run py:lint
Resultado: All checks passed!

npm run py:typecheck
Resultado: Success: no issues found in 23 source files

npm run py:test
Resultado: 95 passed, 1 skipped, 1 warning

npm run py:openapi:check
Resultado: aprovado sem diff

npm run typecheck
Resultado: typecheck web/api/worker aprovado

npm run py:build
Resultado: imagens silo-api-python:migration e silo-worker-python:migration construídas com sucesso

npm run contract:legacy -- --dry-run
Resultado: runner carregou o caso genérico system.health.ok

npm run contract:legacy -- --cases=tests/contracts/legacy/cases.bootstrap.json --base-url=http://127.0.0.1:4011 --out=<temp>
Resultado: FastAPI capturou system.health.ok; status/body normalizados compatíveis com golden Node

Validação concorrente real do rate limit persistente contra PostgreSQL local
Resultado: auth_rate_limit_concurrency_count=24; auth_rate_limit_concurrency_limited=True
```

## Observações

- Headers de infraestrutura não foram tratados como contrato de domínio no comparativo Node × Python:
  Express emite `x-powered-by`/`etag`, FastAPI emite `x-request-id`/`x-response-time-ms`.
  A equivalência validada no Gate 4 é status e body do caso genérico.
- O handler de `RequestValidationError` retorna 400, envelope `{ success: false, error, field? }`
  e não retorna `detail` nem schema Pydantic.
- O rate limit global retorna o mesmo payload 429 do middleware Node.
- O rate limit persistente de auth falha fechado em indisponibilidade de banco no status
  e ignora gravação/limpeza quando o banco está indisponível, espelhando o legado.
