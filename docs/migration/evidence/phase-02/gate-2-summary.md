# Gate 2 — Fundação Python/FastAPI

Data: 2026-07-22

## Status

Aprovado.

## Comandos obrigatórios executados

Diretório: `backend`

```powershell
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
uv lock --check
uv sync --locked --all-groups
uv run --locked ruff format --check .
uv run --locked ruff check .
uv run --locked mypy src
uv run --locked pytest -q --cov=silo --cov-report=term-missing
```

Resultado final:

- `uv lock --check`: aprovado
- `uv sync --locked --all-groups`: aprovado; `Resolved 87 packages`; `Checked 85 packages`
- `ruff format --check .`: aprovado; `18 files already formatted`
- `ruff check .`: aprovado; `All checks passed!`
- `mypy src`: aprovado; `Success: no issues found in 8 source files`
- `pytest -q --cov=silo --cov-report=term-missing`: aprovado; `48 passed`
- cobertura total reportada: `87%`
- warning conhecido: `fastapi.testclient`/Starlette deprecation; não falhou

Diretório do repositório:

```powershell
docker compose -f docker-compose.yml -f docker-compose.migration.yml build api-python
docker compose -f docker-compose.yml -f docker-compose.migration.yml up -d api-python
```

Resultado final:

- build `silo-api-python:migration`: aprovado
- `api-python`: criado/recriado e iniciado

## Validações operacionais adicionais

`GET /health` em `4001`:

```json
{"status":"ok","app":"silo-api","timestamp":"2026-07-22T16:05:40.369738Z"}
```

Imagem/container não-root:

```text
image user=silo
container uid=10001
```

Estado Compose:

```text
NAME              IMAGE                       COMMAND                  SERVICE      CREATED          STATUS                    PORTS
silo-api-python   silo-api-python:migration   "/usr/bin/tini -- uv…"   api-python   19 seconds ago   Up 18 seconds (healthy)   0.0.0.0:4001->4001/tcp, [::]:4001->4001/tcp
```

## Correções durante o gate

### Falha 1 — `uv sync --locked --frozen`

O primeiro build falhou em Linux:

```text
error: the argument '--locked' cannot be used with '--frozen'
```

Correção:

- remover `--frozen` do Dockerfile
- manter `--locked`, que continua impedindo alteração do lock durante o build
- atualizar `backend/tests/unit/test_dockerfile_contract.py`
- atualizar evidência da Fase 2.13

### Falha 2 — `ModuleNotFoundError: No module named 'silo'`

Após build aprovado, o container reiniciava porque `uvicorn` não encontrava o pacote `silo`.

Correção:

- adicionar `PYTHONPATH=/app/src` ao runtime Docker
- atualizar `backend/tests/unit/test_dockerfile_contract.py`
- atualizar evidência da Fase 2.13

Após as duas correções, os comandos obrigatórios do Gate 2 foram repetidos e aprovados.

## Observações

- `docker compose` emitiu warnings sobre variáveis ausentes vindos do compose base existente (`KAFKA_REST_PROXY_URL`, `KAFKA_REST_PROXY_AUTH`, `PRODUCT_FLOW_API_KEY`, `KAFKA_TOPICS`). Esses warnings não bloquearam o Gate 2 porque `api-python` subiu e `/health` passou.
- Nenhum tráfego real foi roteado para a API Python; apenas health local em `localhost:4001`.
- Nenhuma DDL/migration de banco foi executada.
- `api-python` permanece rodando conforme comando obrigatório `up -d api-python`.

## `git diff --check`

Executado após as correções finais.

Resultado:

- Aprovado.
- Avisos CRLF/LF em `.gitignore`, `.gitlab-ci.yml`, `env.example` e nos dois arquivos TypeScript previamente sujos e fora do escopo.
