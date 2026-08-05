# Fase 3.10 — Baseline Alembic completa

Data: 2026-07-22

## Objetivo

Criar uma migration baseline que constrói um banco vazio com extensões, tabelas, constraints e índices do schema atual.

## Implementação

- `apps/backend/alembic.ini`
- `apps/backend/migrations/env.py`
- `apps/backend/migrations/script.py.mako`
- `apps/backend/migrations/versions/phase3_baseline_phase_3_baseline.py`

## Conteúdo da baseline

- Extensões:
  - `pgcrypto`;
  - `vector`;
  - `pg_trgm`.
- 40 tabelas de aplicação.
- 323 colunas de aplicação.
- PKs, FKs, uniques, defaults server-side e 38 índices.
- Índices HNSW para embeddings e GIN/trigram para busca híbrida.

## Ajuste de nomes longos de FK

SQLAlchemy bloqueou nomes de constraint acima de 63 caracteres. O baseline usa os nomes físicos efetivos truncados para 63 caracteres, que é o limite do PostgreSQL:

- `product_problem_problem_category_id_product_problem_category_id`
- `product_solution_checked_product_solution_id_product_solution_i`
- `product_solution_image_product_solution_id_product_solution_id_`
- `product_activity_problem_category_id_product_problem_category_i`
- `product_activity_history_product_activity_id_product_activity_i`

## Banco descartável

Banco usado:

```text
silo_phase3_alembic_codegen
```

Comandos principais:

```text
docker exec silo-db psql -U silo -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS silo_phase3_alembic_codegen WITH (FORCE);" -c "CREATE DATABASE silo_phase3_alembic_codegen OWNER silo;"
```

```text
$env:DATABASE_URL = "postgresql://silo:silo@localhost:5432/silo_phase3_alembic_codegen"
uv --directory apps/backend run --locked alembic upgrade phase3_baseline
```

Resultado:

```text
Running upgrade  -> phase3_baseline, phase 3 baseline
```

## Fingerprint pós-upgrade baseline

Incluindo `alembic_version`:

- fingerprint: `763ee196d33b95709fbaa726ea44d0db0a3c4c603dc0ad7d782f94ed91a8cc82`
- tabelas brutas: 41
- colunas brutas: 324

Equivalência:

- 40 tabelas de aplicação;
- 323 colunas de aplicação;
- 1 tabela/1 coluna de controle Alembic.

## Hashes de controle

- `apps/backend/alembic.ini`: `A8D01EC3F46FCC333ECFCBF12564F6E082D72689FD0F0ACEF0A34A27C75A81D9`
- `apps/backend/migrations/env.py`: `615F561D1CE9BB3527584D31D694FE7E834602CE6613C9892948AC3DDE03F526`
- `apps/backend/migrations/versions/phase3_baseline_phase_3_baseline.py`: `B2E5B15EDD6F69B01002CD8C34AD078E371769BD0B7FF8D104AA9056BE82664F`
- `apps/backend/src/silo/db/models.py`: `6436AA0FE8D3C313EB619B3B2943AD710BF5914C975A6164E56BF9565C2A2B48`

## Gate da fase

A Fase 3.10 está aprovada localmente. A baseline constrói o schema vazio com as extensões e objetos esperados.
