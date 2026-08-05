# Fase 3.11 — Fingerprint local e stamp do baseline

Data: 2026-07-22

## Objetivo

Simular banco local existente sem `alembic_version`, calcular fingerprint canônico e somente então executar `alembic stamp phase3_baseline`.

## Procedimento executado

O banco descartável `silo_phase3_alembic_codegen` foi criado com o schema baseline, depois a tabela `alembic_version` foi removida para simular um banco existente não gerenciado por Alembic.

```text
docker exec silo-db psql -U silo -d silo_phase3_alembic_codegen -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS alembic_version;"
```

Fingerprint pré-stamp:

```text
npm run py:capture-schema -- --database-url postgresql://silo:silo@localhost:5432/silo_phase3_alembic_codegen
```

Resultado:

- fingerprint pré-stamp: `327767b17f420d31788fdd26fa0f0c09e66e6626178ef58aeb9c6fbeeb4750d9`
- tabelas de aplicação: 40
- colunas de aplicação: 323

Stamp:

```text
$env:DATABASE_URL = "postgresql://silo:silo@localhost:5432/silo_phase3_alembic_codegen"
uv --directory apps/backend run --locked alembic stamp phase3_baseline
```

Resultado:

```text
Running stamp_revision  -> phase3_baseline
```

Verificação:

```text
uv --directory apps/backend run --locked alembic current --check-heads
phase3_baseline (head)
```

## Gate da fase

A Fase 3.11 está aprovada localmente para banco descartável. A execução real em staging/produção permanece pendente do Subgate 3B.
