# Fase 2.9 — Logging JSON com redaction

Data: 2026-07-22

## Objetivo

Implementar logging JSON com timestamp UTC, level, service, request_id e contexto, com redaction obrigatória.

## Arquivos criados

- `backend/src/silo/logging.py`
- `backend/tests/unit/test_logging.py`

## Implementação

`backend/src/silo/logging.py` define:

- `JsonLogFormatter`
- `configure_json_logging(service, level)`
- `set_request_id(request_id)`
- `reset_request_id(token)`
- `get_request_id()`
- `redact_context(value)`

## Shape do log JSON

Campos emitidos:

- `timestamp`
  - UTC
  - ISO-8601
  - sufixo `Z`
- `level`
- `service`
- `request_id`
- `message`
- `context`
- `exception`, quando houver exceção

## Request ID

Prioridade:

1. `record.request_id` recebido por `logging(..., extra={"request_id": ...})`
2. `ContextVar` configurado por `set_request_id(...)`
3. `null`, se ausente

## Redaction

Redaction recursiva obrigatória em contextos:

- mappings/dicts
- listas/tuplas/sequências
- sets
- enums
- paths
- datetimes
- bytes
- objetos arbitrários via `repr`

Chaves sensíveis redigidas:

- `api_key`
- `apikey`
- `authorization`
- `cookie`
- `credential`
- `database_url`
- `dsn`
- `password`
- `private_key`
- `secret`
- `token`

Valores sensíveis redigidos:

- strings iniciadas por `Bearer `
- strings iniciadas por `Basic `
- URLs com credenciais no formato `scheme://user:password@host`

Marcador:

- `[REDACTED]`

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

- `ruff format --check .`: aprovado; `7 files already formatted`.
- `ruff check .`: aprovado; `All checks passed!`.
- `mypy src`: aprovado; `Success: no issues found in 3 source files`.
- `pytest -q`: aprovado; `20 passed`.

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

A primeira execução encontrou lint pendente em `backend/src/silo/logging.py`:

- ordenação de imports
- aliases de tipo no padrão antigo

Correção aplicada:

- uso do syntax `type` do Python 3.13 para aliases
- `ruff check --fix` para import order

A sequência completa foi repetida com sucesso.

## Status

Aprovada.
