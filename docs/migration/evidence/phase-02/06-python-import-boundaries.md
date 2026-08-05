# Fase 2.6 — Fronteiras de import do backend Python

Data: 2026-07-22

## Objetivo

Configurar imports por pacote `src/` e impedir acoplamento acidental do backend Python com código legado em `apps/*`.

## Arquivos alterados

- `backend/tests/unit/test_import_boundaries.py`

## Controles implementados

Foi criado um teste arquitetural que analisa AST dos arquivos Python em:

- `backend/src`
- `backend/tests`
- `backend/migrations`

O teste ignora apenas artefatos locais/cache:

- `.venv`
- `.mypy_cache`
- `.pytest_cache`
- `.ruff_cache`
- `__pycache__`

O teste falha se encontrar:

- `import apps`
- `import apps.*`
- `from apps... import ...`
- `from sys import path`
- qualquer uso de `sys.path` ou alias direto de `sys.path`
- import dinâmico de `apps`/`apps.*` por:
  - `importlib.import_module("apps...")`
  - alias de `importlib.import_module`
  - `__import__("apps...")`

## Relação com imports por pacote `src/`

A Fase 2.5 já definiu em `backend/pyproject.toml`:

```toml
[tool.pytest.ini_options]
pythonpath = ["src"]
```

Assim, os testes importam o pacote Python a partir de `backend/src`, sem necessidade de hacks de `sys.path`.

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

- `ruff format --check .`: aprovado; `3 files already formatted`.
- `ruff check .`: aprovado; `All checks passed!`.
- `mypy src`: aprovado; `Success: no issues found in 1 source file`.
- `pytest -q`: aprovado; `3 passed`.

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

A primeira execução de validação encontrou formatação/lint pendentes no novo teste. A causa foi corrigida com Ruff (`ruff format` e `ruff check --fix`) e a sequência completa foi repetida com sucesso.

## Status

Aprovada.
