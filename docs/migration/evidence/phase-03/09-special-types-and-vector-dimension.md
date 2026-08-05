# Fase 3.9 — JSONB, DATE, UUID e Vector(768)

Data: 2026-07-22

## Objetivo

Mapear explicitamente tipos especiais do schema legado e registrar a dimensão vetorial em uma constante única.

## Implementação

- `PGVECTOR_DIMENSIONS = 768` em `apps/backend/src/silo/db/models.py`;
- `Vector768.get_col_spec()` passa a derivar de `PGVECTOR_DIMENSIONS`;
- metadados SQLAlchemy validados para:
  - 4 colunas `JSONB`;
  - 8 colunas `DATE`;
  - 20 colunas `UUID`;
  - 5 colunas `vector(768)`.

## Extensões relacionadas

A Fase 3.9 só modela tipos. A criação das extensões fica na baseline da Fase 3.10:

- `vector`;
- `pg_trgm`;
- `pgcrypto`, necessário para `gen_random_uuid()`.

## Validações executadas

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:format:check
24 files already formatted
```

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:lint
All checks passed!
```

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:typecheck
Success: no issues found in 12 source files
```

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:test
60 passed, 1 skipped, 1 warning in 0.90s
```

## Gate da fase

A Fase 3.9 está aprovada localmente. A dimensão de vetor está centralizada e as contagens de tipos especiais são derivadas do schema versionado.
