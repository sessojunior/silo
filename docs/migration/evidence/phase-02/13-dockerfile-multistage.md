# Fase 2.13 — Dockerfile Python multi-stage

Data: 2026-07-22

## Objetivo

Criar `backend/Dockerfile` multi-stage com targets `api` e `worker`, usuário não-root, init apropriado, `PYTHONDONTWRITEBYTECODE=1`, `PYTHONUNBUFFERED=1` e lock congelado.

## Arquivos criados/alterados

- `backend/Dockerfile`
- `backend/tests/unit/test_dockerfile_contract.py`

## Implementação

Stages:

- `uv`
  - imagem `ghcr.io/astral-sh/uv:0.11.28`
- `python-base`
  - imagem `python:3.13.14-slim-bookworm`
  - instala `ca-certificates` e `tini`
  - cria usuário/grupo `silo` com UID/GID `10001`
  - valida `sys.version_info[:2] == (3, 13)`
- `deps`
  - copia `pyproject.toml` e `uv.lock`
  - executa `uv sync --locked --no-dev --no-install-project --compile-bytecode`
- `runtime`
  - copia `README.md` e `src`
  - executa `uv sync --locked --no-dev --compile-bytecode`
  - troca ownership para `silo:silo`
  - define `USER silo`
  - usa `ENTRYPOINT ["/usr/bin/tini", "--"]`
- `api`
  - expõe `4001`
  - executa `uvicorn silo.api.main:app --host 0.0.0.0 --port 4001`
- `worker`
  - define target separado
  - `CMD ["python", "-m", "silo.worker.main"]`

Variáveis fixadas:

- `PYTHONDONTWRITEBYTECODE=1`
- `PYTHONUNBUFFERED=1`
- `UV_COMPILE_BYTECODE=1`
- `UV_LINK_MODE=copy`
- `UV_PYTHON_DOWNLOADS=never`
- `PYTHONPATH=/app/src`
- `PORT=4001`

## Validação estática

Foi criado `backend/tests/unit/test_dockerfile_contract.py`, cobrindo:

- runtime Python 3.13.14
- flags obrigatórias de bytecode/unbuffered
- uso de `uv` 0.11.28
- `uv sync --locked --no-dev`
- usuário não-root
- `tini`
- targets `api` e `worker`

## Limite da etapa

Esta etapa cria e valida estaticamente o Dockerfile. O overlay Compose da API Python em `4001` é escopo da Fase 2.14; `.gitignore` Python é escopo da Fase 2.15; scripts raiz e build consolidado são escopo da Fase 2.16.

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

- `ruff format --check .`: aprovado; `14 files already formatted`.
- `ruff check .`: aprovado; `All checks passed!`.
- `mypy src`: aprovado; `Success: no issues found in 7 source files`.
- `pytest -q`: aprovado; `38 passed`.
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

- A primeira execução encontrou formatação pendente em `test_dockerfile_contract.py`; corrigido com `ruff format`.
- A execução seguinte encontrou import order pendente no mesmo teste; corrigido com `ruff check --fix`.
- A sequência completa foi repetida com sucesso.
- Correção posterior durante o Gate 2: o build Linux demonstrou que `uv sync` 0.11.28 rejeita `--locked` junto com `--frozen`. O Dockerfile foi corrigido para usar `--locked` sem `--frozen`, preservando a garantia de não alterar `uv.lock`.
- Correção posterior durante o Gate 2: o container subia mas `uvicorn` falhava com `ModuleNotFoundError: No module named 'silo'`. O runtime Docker foi corrigido com `PYTHONPATH=/app/src`, alinhado ao layout `src/`.

## Status

Aprovada.
