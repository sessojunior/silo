# Fase 3.13 — Alembic check e current --check-heads

Data: 2026-07-22

## Objetivo

Executar os checks Alembic obrigatórios contra o banco descartável no head local.

## Ajuste aplicado

O primeiro `alembic check` passou, mas emitiu warnings de reflexão para colunas `vector`. Para deixar o gate limpo, `apps/backend/migrations/env.py` registra `Vector768` em `ischema_names["vector"]`.

## Comandos executados

```text
$env:DATABASE_URL = "postgresql://silo:silo@localhost:5432/silo_phase3_alembic_codegen"
uv --directory apps/backend run --locked alembic check
```

Resultado:

```text
No new upgrade operations detected.
```

```text
uv --directory apps/backend run --locked alembic current --check-heads
```

Resultado:

```text
phase3_baseline (head)
```

## Gates Python executados após formatação da migration

```text
npm run py:format:check
26 files already formatted
```

```text
npm run py:lint
All checks passed!
```

```text
npm run py:typecheck
Success: no issues found in 12 source files
```

```text
npm run py:test
60 passed, 1 skipped, 1 warning in 0.95s
```

## Gate da fase

A Fase 3.13 está aprovada localmente. Alembic não detecta operações novas e o banco está no head esperado.
