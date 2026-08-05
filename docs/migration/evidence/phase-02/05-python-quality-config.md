# Fase 2.5 — Configuração de qualidade Python

Data: 2026-07-22

## Objetivo

Configurar qualidade mínima determinística do backend Python antes de iniciar código funcional:

- Ruff para formatação e lint.
- mypy em modo `strict` para `src/silo`.
- pytest com configuração central.
- cobertura para o pacote `silo`.

## Arquivos alterados

- `backend/pyproject.toml`
- `backend/tests/unit/test_python_runtime_version.py`

## Configuração aplicada

`backend/pyproject.toml` define:

- `[tool.ruff]`
  - `target-version = "py313"`
  - `line-length = 100`
  - `src = ["src", "tests"]`
- `[tool.ruff.lint]`
  - `select = ["E", "F", "I", "UP", "B", "RUF"]`
- `[tool.mypy]`
  - `python_version = "3.13"`
  - `strict = true`
  - `mypy_path = "src"`
  - `files = ["src/silo"]`
- `[tool.pytest.ini_options]`
  - `testpaths = ["tests"]`
  - `pythonpath = ["src"]`
  - `addopts = ["--strict-config", "--strict-markers"]`
  - `asyncio_mode = "auto"`
- `[tool.coverage.run]`
  - `branch = true`
  - `source = ["silo"]`
- `[tool.coverage.report]`
  - `show_missing = true`
  - `skip_covered = true`

## Validações executadas

Diretório: `backend`

```powershell
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
uv run --locked ruff format .
uv run --locked ruff format --check .
uv run --locked ruff check .
uv run --locked mypy src
uv run --locked pytest -q --cov=silo --cov-report=term-missing
```

Resultados:

- `ruff format .`: formatou a árvore Python inicial quando necessário.
- `ruff format --check .`: aprovado; `2 files already formatted`.
- `ruff check .`: aprovado; `All checks passed!`.
- `mypy src`: aprovado; `Success: no issues found in 1 source file`.
- `pytest -q --cov=silo --cov-report=term-missing`: aprovado; `2 passed`.

Diretório do repositório:

```powershell
git diff --check
```

Resultado:

- Aprovado.
- Observação: o comando emitiu apenas avisos de conversão CRLF/LF nos arquivos TypeScript previamente sujos e fora do escopo:
  - `apps/api/src/scripts/backfill-embeddings.ts`
  - `apps/api/src/services/embedding-write-service.ts`

## Decisões

- A etapa não altera política de cobertura mínima; ela apenas ativa coleta de cobertura para o pacote `silo`, porque os módulos funcionais ainda serão criados nas próximas fases.
- A correção de `.gitignore` para artefatos locais da virtualenv permanece na Fase 2.15, conforme sequência do plano.

## Status

Aprovada.
