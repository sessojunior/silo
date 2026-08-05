# Fase 3.17 — Serviço `migrate`, advisory lock e readiness Alembic

Data: 2026-07-22

## Resultado

Implementado:

- `apps/backend/src/silo/db/migrate.py`;
- `apps/backend/src/silo/db/migration_state.py`;
- serviço one-shot `migrate` em `docker-compose.migration.yml`;
- `api-python` depende de `migrate: condition: service_completed_successfully`;
- readiness em `apps/backend/src/silo/db/health.py` exige que `alembic_version` seja igual ao head esperado.

Advisory lock PostgreSQL:

```text
4700310630037
```

O health check foi implementado com SQLAlchemy síncrono dentro de `asyncio.to_thread` para evitar falha local no Windows com `psycopg` async e `ProactorEventLoop`.

## Gate local

Banco descartável:

```text
silo_phase3_migrate
```

Comandos:

```powershell
docker exec silo-db psql -U silo -d postgres -v ON_ERROR_STOP=1 `
  -c "DROP DATABASE IF EXISTS silo_phase3_migrate WITH (FORCE);" `
  -c "CREATE DATABASE silo_phase3_migrate OWNER silo;"
$env:DATABASE_URL = "postgresql://silo:silo@localhost:5432/silo_phase3_migrate"
uv --directory apps/backend run --locked python -m silo.db.migrate
uv --directory apps/backend run --locked alembic current --check-heads
```

Resultado antes da revision aditiva:

```text
phase3_baseline (head)
database-ready-ok
```

Após a Fase 3.18, o head esperado passa a ser `phase3_artifact`; o mesmo serviço aplica `baseline → artifact`.

## Validação de Compose e Dockerfile

Compose combinado:

```powershell
docker compose -f docker-compose.yml -f docker-compose.migration.yml config --services
```

Resultado:

```text
db
ollama
api
worker
migrate
api-python
web
```

Build:

```powershell
npm run py:build
```

Resultado: targets Docker `api` e `worker` construídos com exit code 0.
