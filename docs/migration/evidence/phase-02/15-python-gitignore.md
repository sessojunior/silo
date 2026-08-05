# Fase 2.15 — `.gitignore` para Python

Data: 2026-07-22

## Objetivo

Atualizar `.gitignore` para `.venv`, caches e coverage Python; não ignorar `uv.lock` nem migrations.

## Arquivo alterado

- `.gitignore`

## Padrões adicionados

```gitignore
# python
backend/.venv/
backend/.mypy_cache/
backend/.pytest_cache/
backend/.ruff_cache/
backend/.coverage
backend/htmlcov/
backend/**/__pycache__/
backend/**/*.py[cod]
backend/.hypothesis/
```

## Validação de ignore

Comando:

```powershell
$ignored = @(
  'backend/.venv/pyvenv.cfg',
  'backend/.mypy_cache/meta.json',
  'backend/.pytest_cache/README.md',
  'backend/.ruff_cache/CACHEDIR.TAG',
  'backend/src/silo/__pycache__/module.pyc',
  'backend/.coverage'
)
foreach ($path in $ignored) {
  git check-ignore -q $path
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

$notIgnored = @(
  'backend/uv.lock',
  'backend/migrations/versions/0001_example.py'
)
foreach ($path in $notIgnored) {
  git check-ignore -q $path
  if ($LASTEXITCODE -eq 0) { exit 1 }
}
```

Resultado:

```text
gitignore python patterns OK
```

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
git diff --check
```

Resultado:

- Aprovado.
- Observação: o comando emitiu avisos CRLF/LF em:
  - `.gitignore`, editado nesta etapa
  - `apps/api/src/scripts/backfill-embeddings.ts`, previamente sujo e fora do escopo
  - `apps/api/src/services/embedding-write-service.ts`, previamente sujo e fora do escopo

## Status

Aprovada.
