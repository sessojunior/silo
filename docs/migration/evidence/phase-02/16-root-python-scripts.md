# Fase 2.16 — Scripts raiz Python

Data: 2026-07-22

## Objetivo

Adicionar scripts raiz `py:sync`, `py:lint`, `py:format:check`, `py:typecheck`, `py:test`, `py:build` sem remover scripts Node.

## Arquivo alterado

- `package.json`

## Scripts adicionados

```json
{
  "py:sync": "uv --directory backend sync --locked --all-groups",
  "py:lint": "uv --directory backend run --locked ruff check .",
  "py:format:check": "uv --directory backend run --locked ruff format --check .",
  "py:typecheck": "uv --directory backend run --locked mypy src",
  "py:test": "uv --directory backend run --locked pytest -q",
  "py:build": "docker build --target api -t silo-api-python:migration -f backend/Dockerfile backend && docker build --target worker -t silo-worker-python:migration -f backend/Dockerfile backend"
}
```

Scripts Node existentes foram preservados.

## Validações executadas

Diretório do repositório:

```powershell
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package json ok')"
npm run py:sync
npm run py:format:check
npm run py:lint
npm run py:typecheck
npm run py:test
npm pkg get scripts.py:build
git diff --check
```

Resultados:

- `package json ok`
- `npm run py:sync`: aprovado; `Resolved 87 packages`; `Checked 85 packages`
- `npm run py:format:check`: aprovado; `15 files already formatted`
- `npm run py:lint`: aprovado; `All checks passed!`
- `npm run py:typecheck`: aprovado; `Success: no issues found in 7 source files`
- `npm run py:test`: aprovado; `42 passed`
- `npm pkg get scripts.py:build`: confirmou build dos targets `api` e `worker`
- `git diff --check`: aprovado

Observações:

- `npm run py:test` emitiu 1 warning de depreciação do `fastapi.testclient`/Starlette. Não houve falha.
- `git diff --check` emitiu avisos CRLF/LF em `.gitignore` e nos dois arquivos TypeScript previamente sujos e fora do escopo.
- `py:build` não foi executado nesta etapa porque faz build Docker completo dos dois targets; a validação da imagem é parte do Gate 2.

## Status

Aprovada.
