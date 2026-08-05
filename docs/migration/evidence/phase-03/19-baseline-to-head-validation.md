# Fase 3.19 — Validação baseline→head e compatibilidade Node

Data: 2026-07-22

## Caminho 1: banco vazio → head

Banco descartável:

```text
silo_phase3_head_empty
```

Resultado:

```text
phase3_artifact (head)
app_tables=41
app_columns=346
artifact_tables=1
```

## Caminho 2: baseline restaurado/stampado → head

Banco descartável:

```text
silo_phase3_restore_to_head
```

Procedimento:

```powershell
uv --directory apps/backend run --locked alembic upgrade phase3_baseline
docker exec silo-db psql -U silo -d silo_phase3_restore_to_head `
  -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS alembic_version;"
uv --directory apps/backend run --locked alembic stamp phase3_baseline
uv --directory apps/backend run --locked alembic upgrade head
uv --directory apps/backend run --locked alembic current --check-heads
```

Resultado:

```text
phase3_artifact (head)
app_tables=41
app_columns=346
artifact_tables=1
```

## Node ignora a tabela

Busca:

```powershell
rg -n "ai_assistant_artifact|aiAssistantArtifact" apps/api apps/frontend packages
```

Resultado:

```text
no-node-artifact-references
```

Typecheck da API Node:

```powershell
npm run typecheck:api
```

Resultado:

```text
tsc --noEmit
```

Exit code: 0.

Conclusão: o único delta pós-baseline é a tabela aditiva `ai_assistant_artifact`; o Node não referencia a tabela e o typecheck da API Node continua passando.

