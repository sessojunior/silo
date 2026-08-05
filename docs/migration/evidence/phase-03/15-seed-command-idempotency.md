# Fase 3.15 — Comando explícito `uv run silo-db-seed` e idempotência

Data: 2026-07-22

## Resultado

Comando console criado em `apps/backend/pyproject.toml`:

```toml
[project.scripts]
silo-db-seed = "silo.db.seed:main"
```

O projeto Python foi tornado instalável com Hatchling para que `uv run silo-db-seed` exista em ambientes locais e no container.

## Gate executado

Banco descartável:

```text
silo_phase3_seed
```

Comandos:

```powershell
docker exec silo-db psql -U silo -d postgres -v ON_ERROR_STOP=1 `
  -c "DROP DATABASE IF EXISTS silo_phase3_seed WITH (FORCE);" `
  -c "CREATE DATABASE silo_phase3_seed OWNER silo;"
$env:DATABASE_URL = "postgresql://silo:silo@localhost:5432/silo_phase3_seed"
uv --directory apps/backend run --locked alembic upgrade head
uv --directory apps/backend run --locked silo-db-seed --database-url $env:DATABASE_URL
uv --directory apps/backend run --locked silo-db-seed --database-url $env:DATABASE_URL
```

Primeira execução:

```json
{"existing": {}, "inserted": {"account": 5, "chat_user_presence": 5, "contact": 3, "group": 4, "group_permissions": 54, "help": 1, "product": 4, "product_contact": 12, "product_manual": 4, "product_manual_chunk": 8, "product_problem_category": 4, "project": 1, "project_activity": 1, "project_task": 1, "project_task_user": 1, "user": 5, "user_group": 6, "user_preferences": 5, "user_profile": 1}}
```

Segunda execução:

```json
{"existing": {"account": 5, "chat_user_presence": 5, "contact": 3, "group": 4, "group_permissions": 54, "help": 1, "product": 4, "product_contact": 12, "product_manual": 4, "product_manual_chunk": 4, "product_problem_category": 4, "project": 1, "project_activity": 1, "project_task": 1, "project_task_user": 1, "user": 5, "user_group": 6, "user_preferences": 5, "user_profile": 1}, "inserted": {}}
```

Contagens finais:

```text
account=5
contact=3
group=4
group_permissions=54
help=1
product=4
product_contact=12
product_manual=4
product_manual_chunk=8
product_problem_category=4
project=1
project_activity=1
project_task=1
project_task_user=1
user=5
user_group=6
```

Conclusão: segunda execução não criou duplicatas.

