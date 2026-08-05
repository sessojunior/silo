# Fase 3.12 — Upgrade head em banco vazio

Data: 2026-07-22

## Objetivo

Executar `alembic upgrade head` em banco vazio e comparar o schema resultante com o snapshot local versionado.

## Execução local

Na execução desta fase, `head` ainda corresponde a `phase3_baseline`.

Banco descartável:

```text
silo_phase3_alembic_codegen
```

Comandos:

```text
docker exec silo-db psql -U silo -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS silo_phase3_alembic_codegen WITH (FORCE);" -c "CREATE DATABASE silo_phase3_alembic_codegen OWNER silo;"
```

```text
$env:DATABASE_URL = "postgresql://silo:silo@localhost:5432/silo_phase3_alembic_codegen"
uv --directory apps/backend run --locked alembic upgrade phase3_baseline
```

Resultado:

- upgrade aplicado sem erro;
- 40 tabelas de aplicação;
- 323 colunas de aplicação;
- extensões `pgcrypto`, `vector`, `pg_trgm`;
- `alembic_version` em `phase3_baseline`.

## Comparação com snapshot versionado

A comparação local é feita por duas camadas:

1. `apps/backend/tests/unit/test_sqlalchemy_models.py` compara o metadata SQLAlchemy com `packages/db/src/schema.ts`;
2. `npm run py:capture-schema` confirma o schema criado no PostgreSQL descartável.

Fingerprint com `alembic_version`:

```text
763ee196d33b95709fbaa726ea44d0db0a3c4c603dc0ad7d782f94ed91a8cc82
```

## Gate da fase

A Fase 3.12 está aprovada localmente. A comparação com snapshot real de staging/produção continua obrigatória no Subgate 3B.
