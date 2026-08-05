# Fase 2.14 — Overlay Compose da API Python

Data: 2026-07-22

## Objetivo

Criar overlay `docker-compose.migration.yml` com `api-python:4001`; não expor worker Python ainda.

## Arquivos criados

- `docker-compose.migration.yml`
- `backend/tests/unit/test_compose_migration_contract.py`

## Implementação

Serviço adicionado:

- `api-python`

Características:

- build context: `./backend`
- Dockerfile: `Dockerfile`
- target: `api`
- imagem: `silo-api-python:migration`
- container: `silo-api-python`
- porta host: `${API_PYTHON_PORT:-4001}`
- porta interna: `4001`
- volume: `silo-storage-data:/app/uploads`
- `UPLOADS_DIR=/app/uploads`
- healthcheck em `GET /health/live`
- depende de `db` e `ollama` como `service_started`

Não foi criado:

- serviço `worker-python`
- exposição do target Docker `worker`
- consumidor Kafka Python

## Variáveis encaminhadas

O overlay encaminha as famílias de ambiente já cobertas por `Settings`:

- ambiente/configuração
- banco
- APP URLs/basePath/CORS
- sessão/Better Auth temporário
- SMTP
- Google
- Product Flow
- uploads
- Kafka REST
- Ollama

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

- `ruff format --check .`: aprovado; `15 files already formatted`.
- `ruff check .`: aprovado; `All checks passed!`.
- `mypy src`: aprovado; `Success: no issues found in 7 source files`.
- `pytest -q`: aprovado; `42 passed`.
- Observação: `pytest` emitiu 1 warning de depreciação do `fastapi.testclient`/Starlette. Não houve falha.

Diretório do repositório:

```powershell
docker compose -f docker-compose.yml -f docker-compose.migration.yml config --services
```

Resultado:

```text
db
ollama
api
worker
api-python
web
```

Observação: o comando emitiu warnings sobre variáveis ausentes (`KAFKA_REST_PROXY_URL`, `KAFKA_REST_PROXY_AUTH`, `PRODUCT_FLOW_API_KEY`, `KAFKA_TOPICS`) vindos do compose base existente. O overlay novo usa defaults `${VAR:-}` para as variáveis que adiciona.

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

A primeira execução encontrou import order pendente em `test_compose_migration_contract.py`; corrigido com `ruff check --fix`. A sequência completa foi repetida com sucesso.

## Status

Aprovada.
