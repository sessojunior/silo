# Fase 2.12 — Readiness com configuração e DB

Data: 2026-07-22

## Objetivo

Fazer `GET /health/ready` validar configuração e DB quando configurado. A verificação de revision em head fica para a Fase 3, após existir baseline Alembic. Ollama/Kafka não bloqueiam readiness geral, mas aparecem no status interno.

## Arquivos criados/alterados

- `backend/src/silo/api/routers/health.py`
- `backend/src/silo/db/health.py`
- `backend/tests/unit/test_fastapi_health.py`

## Implementação

`GET /health/ready` agora retorna `200` quando checks bloqueantes passam e `503` quando config ou DB falham.

Checks:

- `config`
  - bloqueante
  - usa `load_settings`
- `database`
  - bloqueante
  - executa `SELECT 1` via SQLAlchemy async quando `database_url` existe
  - converte `postgresql://` e `postgres://` para `postgresql+psycopg://`
- `ollama`
  - não bloqueante
  - aparece como status interno
- `kafka`
  - não bloqueante
  - `ok` quando `KAFKA_REST_PROXY_URL` está configurada
  - `not_configured` quando ausente

## Sanitização

- Falha de settings retorna detalhe genérico `invalid configuration`.
- Falha de DB retorna detalhe genérico `database check failed`.
- DSN, senha, token ou secret não são incluídos no payload de readiness.

## Shape de readiness

```json
{
  "status": "ok",
  "service": "silo-api-python",
  "timestamp": "...",
  "checks": {
    "config": { "status": "ok", "blocking": true, "detail": null },
    "database": { "status": "ok", "blocking": true, "detail": null },
    "ollama": { "status": "ok", "blocking": false, "detail": "configured" },
    "kafka": { "status": "ok", "blocking": false, "detail": "configured" }
  }
}
```

Em falha bloqueante, `status` vira `not_ready` e HTTP status vira `503`.

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

- `ruff format --check .`: aprovado; `13 files already formatted`.
- `ruff check .`: aprovado; `All checks passed!`.
- `mypy src`: aprovado; `Success: no issues found in 7 source files`.
- `pytest -q`: aprovado; `34 passed`.
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

## Correções durante a etapa

- A primeira aplicação de patch não casou por import order já alterado por Ruff; a alteração foi reaplicada substituindo os arquivos-alvo.
- A primeira validação encontrou ordenação de imports; corrigido com `ruff check --fix`.
- A validação seguinte mostrou que defaults de função capturavam dependências antes do monkeypatch de teste; a injeção foi alterada para resolver dependências em runtime.
- Após essa correção houve formatação pendente; corrigida com `ruff format`.
- A sequência completa foi repetida com sucesso.

## Status

Aprovada.
