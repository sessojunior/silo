# Fase 2.17 — CI Node e Python explícitos

Data: 2026-07-22

## Objetivo

Atualizar GitHub Actions e GitLab CI para jobs Node e Python explícitos. Não usar `npx turbo` se Turbo não estiver declarado/lockado.

## Arquivos criados/alterados

- `.github/workflows/ci.yml`
- `.gitlab-ci.yml`
- `backend/tests/unit/test_ci_contract.py`

## GitHub Actions

Workflow atualizado para dois jobs explícitos:

- `node`
  - `npm ci --legacy-peer-deps`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - check legado condicional, somente se `scripts/check-no-legacy-permissions.mjs` existir
  - `npm test --if-present`
- `python`
  - `actions/setup-node@v4`, apenas para scripts npm raiz
  - `astral-sh/setup-uv@v6` com `version: "0.11.28"`
  - `npm run py:sync`
  - `npm run py:format:check`
  - `npm run py:lint`
  - `npm run py:typecheck`
  - `npm run py:test`
  - `npm run py:build`

`npx turbo` foi removido.

## GitLab CI

Validação separada em:

- `validate:node`
  - estende `.node_template`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test --if-present`
- `validate:python`
  - imagem `node:22-bookworm`
  - instala `uv` 0.11.28 pelo instalador versionado
  - usa cache `.uv-cache/` e `backend/.venv/`
  - `npm run py:sync`
  - `npm run py:format:check`
  - `npm run py:lint`
  - `npm run py:typecheck`
  - `npm run py:test`

Build/deploy GitLab existentes foram preservados nesta etapa. Corrigir a estratégia de empacotamento/deploy multi-imagem não faz parte da Fase 2.17.

## Teste de contrato

`backend/tests/unit/test_ci_contract.py` valida estaticamente:

- GitHub Actions contém jobs `node` e `python`
- GitLab CI contém jobs `validate:node` e `validate:python`
- `npx turbo` não aparece nos arquivos de CI
- comandos Node explícitos existem
- comandos Python explícitos existem

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

- `ruff format --check .`: aprovado; `16 files already formatted`.
- `ruff check .`: aprovado; `All checks passed!`.
- `mypy src`: aprovado; `Success: no issues found in 7 source files`.
- `pytest -q`: aprovado; `44 passed`.
- Observação: `pytest` emitiu 1 warning de depreciação do `fastapi.testclient`/Starlette. Não houve falha.

Diretório do repositório:

```powershell
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
@'
from pathlib import Path
import yaml
for path in [Path('../.github/workflows/ci.yml'), Path('../.gitlab-ci.yml')]:
    yaml.safe_load(path.read_text(encoding='utf-8'))
    print(f'{path}: yaml ok')
'@ | uv --directory backend run --locked python -
rg "npx turbo" .github .gitlab-ci.yml
```

Resultado:

- `.github/workflows/ci.yml`: YAML OK
- `.gitlab-ci.yml`: YAML OK
- ausência de `npx turbo` confirmada

Diretório do repositório:

```powershell
git diff --check
```

Resultado:

- Aprovado.
- Observação: o comando emitiu avisos CRLF/LF em:
  - `.gitignore`
  - `.gitlab-ci.yml`, editado nesta etapa
  - `apps/api/src/scripts/backfill-embeddings.ts`, previamente sujo e fora do escopo
  - `apps/api/src/services/embedding-write-service.ts`, previamente sujo e fora do escopo

## Correções durante a etapa

- A primeira execução encontrou import order pendente em `test_ci_contract.py`; corrigido com `ruff check --fix`.
- A primeira checagem YAML usou heredoc Bash inválido no PowerShell; repetida com here-string PowerShell.
- A segunda checagem YAML usou cwd incorreto porque `uv --directory backend` muda o diretório; repetida com caminhos `../`.
- A sequência final foi aprovada.

## Status

Aprovada.
