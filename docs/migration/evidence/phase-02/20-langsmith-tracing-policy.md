# Fase 2.20 — Política LangSmith/tracing externo

Data: 2026-07-22

## Objetivo

Fixar `LANGSMITH_TRACING=false` e rejeitar boot de produção se tracing externo for habilitado sem flag de aprovação.

## Arquivos alterados

- `backend/src/silo/config.py`
- `backend/tests/unit/test_settings.py`
- `backend/Dockerfile`
- `backend/tests/unit/test_dockerfile_contract.py`
- `docker-compose.migration.yml`
- `backend/tests/unit/test_compose_migration_contract.py`
- `env.example`

## Flag definida

Como o plano não nomeava a flag, a Fase 2.20 definiu:

- `LANGSMITH_TRACING_APPROVED`

Regra:

- default de `LANGSMITH_TRACING`: `false`
- default de `LANGSMITH_TRACING_APPROVED`: `false`
- em produção, `LANGSMITH_TRACING=true` falha se `LANGSMITH_TRACING_APPROVED` não for `true`
- mensagens de erro citam apenas nomes de variáveis, sem valores secretos

## Locais fixados

Dockerfile:

```dockerfile
LANGSMITH_TRACING=false
```

Overlay Compose:

```yaml
LANGSMITH_TRACING: ${LANGSMITH_TRACING:-false}
LANGSMITH_TRACING_APPROVED: ${LANGSMITH_TRACING_APPROVED:-false}
```

`env.example`:

```env
LANGSMITH_TRACING=false
LANGSMITH_TRACING_APPROVED=false
```

## Testes

Foram adicionados testes para:

- carregar settings com LangSmith desativado
- rejeitar produção com `LANGSMITH_TRACING=true` sem approval
- permitir produção com `LANGSMITH_TRACING=true` apenas quando `LANGSMITH_TRACING_APPROVED=true`
- garantir Dockerfile com `LANGSMITH_TRACING=false`
- garantir overlay Compose encaminhando as duas variáveis

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

- `ruff format --check .`: aprovado; `18 files already formatted`.
- `ruff check .`: aprovado; `All checks passed!`.
- `mypy src`: aprovado; `Success: no issues found in 8 source files`.
- `pytest -q`: aprovado; `48 passed`.
- Observação: `pytest` emitiu 1 warning de depreciação do `fastapi.testclient`/Starlette. Não houve falha.

Diretório do repositório:

```powershell
docker compose -f docker-compose.yml -f docker-compose.migration.yml config --services
rg "LANGSMITH_TRACING" backend/Dockerfile docker-compose.migration.yml env.example backend/tests/unit
git diff --check
```

Resultados:

- Compose config aprovado e contém `api-python`.
- `LANGSMITH_TRACING` e `LANGSMITH_TRACING_APPROVED` encontrados nos locais esperados.
- `git diff --check` aprovado.

Observações:

- `docker compose config --services` emitiu warnings sobre variáveis ausentes vindos do compose base existente.
- `git diff --check` emitiu avisos CRLF/LF em `.gitignore`, `.gitlab-ci.yml`, `env.example` e nos dois arquivos TypeScript previamente sujos e fora do escopo.

## Correção durante a etapa

A primeira execução encontrou formatação pendente em `backend/src/silo/config.py`; corrigido com `ruff format`. A sequência completa foi repetida com sucesso.

## Status

Aprovada.
