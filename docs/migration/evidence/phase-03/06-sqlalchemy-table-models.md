# Fase 3.6 — Modelagem inicial das tabelas atuais em SQLAlchemy

Data: 2026-07-22

## Objetivo

Modelar todas as tabelas atuais do schema versionado em SQLAlchemy, sem executar DDL e sem alterar o banco.

## Decisão de escopo desta fase

A Fase 3.6 cobre a representação determinística de tabelas, colunas, tipos básicos, chaves primárias e nulabilidade conforme `packages/db/src/schema.ts`.

Constraints não primárias, FKs, uniques, índices, defaults, extensões e baseline Alembic permanecem nas fases já previstas:

- 3.7: nomes Python vs nomes físicos;
- 3.8: timestamps/serialização;
- 3.9: tipos especiais e constante de vetor;
- 3.10: baseline Alembic completo com constraints/índices/extensões.

## Arquivos implementados

- `apps/backend/src/silo/db/models.py`
- `apps/backend/tests/unit/test_sqlalchemy_models.py`

## Cobertura implementada

- 40 tabelas modeladas em `legacy_metadata`;
- 323 colunas modeladas;
- preservação dos nomes físicos existentes;
- `DateTime(timezone=False)` para colunas `timestamp`;
- `JSONB`, `DATE`, `UUID` e `vector(768)` representados;
- decisão da Fase 3.3 preservada: `group_permissions` usa `resource`/`action`, sem `resource_v2`/`action_v2`;
- `kafka_processed_messages` incluída;
- nenhuma conexão com banco e nenhuma operação DDL nesta fase.

## Hashes de controle

- `packages/db/src/schema.ts`: `03768F613B1495B431BF6ACD09FF2A2BE3B849311DA1AB95B81E28986A5640DA`
- `apps/backend/src/silo/db/models.py`: `143880D77EA744466653370E25C4763D8872C3E7E24F8600EEABE89D83FB3F14`
- `apps/backend/tests/unit/test_sqlalchemy_models.py`: `646332EF776833FCE95030817C123708A4839C61EABB461060286C6B530D84F5`

## Validações executadas

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:format:check

> py:format:check
> uv --directory apps/backend run --locked ruff format --check .

23 files already formatted
```

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:lint

> py:lint
> uv --directory apps/backend run --locked ruff check .

All checks passed!
```

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:typecheck

> py:typecheck
> uv --directory apps/backend run --locked mypy src

Success: no issues found in 11 source files
```

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:test

> py:test
> uv --directory apps/backend run --locked pytest -q

....................................s...................                 [100%]
55 passed, 1 skipped, 1 warning in 0.89s
```

## Gate da fase

A Fase 3.6 está aprovada localmente. A modelagem foi comparada por teste contra `schema.ts` e não depende de logs, telemetria ou dados reais.
