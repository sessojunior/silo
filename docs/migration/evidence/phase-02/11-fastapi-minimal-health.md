# Fase 2.11 — FastAPI mínimo e health endpoints

Data: 2026-07-22

## Objetivo

Criar FastAPI mínimo com lifespan, `GET /health` compatível com Node e novos `GET /health/live` e `GET /health/ready`.

## Arquivos criados

- `backend/src/silo/api/main.py`
- `backend/src/silo/api/routers/health.py`
- `backend/tests/unit/test_fastapi_health.py`

## Implementação

`backend/src/silo/api/main.py` define:

- `create_app()`
- `lifespan(app)`
- `app = create_app()`

`backend/src/silo/api/routers/health.py` define:

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- modelos Pydantic de resposta
- builders testáveis com clock injetável

## Contrato preservado

O Node atual retorna:

```json
{
  "status": "ok",
  "app": "silo-api",
  "timestamp": "..."
}
```

O Python preserva o mesmo shape em `GET /health`.

## Novos endpoints operacionais

`GET /health/live` e `GET /health/ready` retornam:

```json
{
  "status": "ok",
  "service": "silo-api-python",
  "timestamp": "...",
  "checks": {
    "app": "ok"
  }
}
```

Observação: na Fase 2.11, `ready` ainda não valida configuração ou DB. Essa validação pertence à Fase 2.12, conforme plano.

## Validações executadas

Diretório: `backend`

```powershell
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
uv run --locked ruff format --check .
uv run --locked ruff check .
uv run --locked mypy src
uv run --locked pytest -q
```

Resultado:

- `ruff format --check .`: aprovado; `12 files already formatted`.
- `ruff check .`: aprovado; `All checks passed!`.
- `mypy src`: aprovado; `Success: no issues found in 6 source files`.
- `pytest -q`: aprovado; `31 passed`.
- Observação: `pytest` emitiu 1 warning de depreciação do `fastapi.testclient`/Starlette. Não houve falha.

Diretório do repositório:

```powershell
git diff --check
```

Resultado:

- Aprovado.
- Observação: o comando emitiu apenas avisos de conversão CRLF/LF nos arquivos TypeScript previamente sujos e fora do escopo:
  - `apps/api/src/scripts/backfill-embeddings.ts`
  - `apps/api/src/services/embedding-write-service.ts`

## Correção durante a etapa

A primeira execução encontrou ordenação de imports pendente nos arquivos novos; corrigido com `ruff check --fix`. A sequência completa foi repetida com sucesso.

## Status

Aprovada.
