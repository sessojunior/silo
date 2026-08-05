# Fase 3.18 — Migration aditiva `ai_assistant_artifact`

Data: 2026-07-22

## Resultado

Revision Alembic criada:

```text
apps/backend/migrations/versions/phase3_artifact_phase_3_artifact_table.py
revision = phase3_artifact
down_revision = phase3_baseline
```

Tabela aditiva:

```text
ai_assistant_artifact
```

## Contrato implementado

- UUID `id` com `gen_random_uuid()`;
- `user_id`, `thread_id`, `message_id` opcionais;
- FKs `thread_id` e `message_id` com `ON DELETE SET NULL`;
- `kind`, `report_type`, `idempotency_hash`, `request_fingerprint`, `dataset_checksum`, `metric_version`;
- status `pending|ready|failed`;
- `owner_token`, `lease_expires_at`;
- `relative_path`, `url`, `filename`, `mime_type`, `byte_size`, `file_sha256`, `error_message`, `attached_at`;
- `created_at` e `updated_at`;
- unique em `idempotency_hash`;
- índices em `thread_id`, `message_id`, `status`, `lease_expires_at`, `attached_at`;
- checks de `kind`, `status`, MIME PDF, tamanho não negativo e `ready` exigindo `dataset_checksum` + `file_sha256`.

Não armazena blob, prompt ou dataset.

## Gate local

Comandos:

```powershell
$env:DATABASE_URL = "postgresql://silo:silo@localhost:5432/silo_phase3_migrate"
uv --directory apps/backend run --locked alembic upgrade head
uv --directory apps/backend run --locked alembic check
uv --directory apps/backend run --locked alembic current --check-heads
```

Resultado:

```text
No new upgrade operations detected.
phase3_artifact (head)
```

Inspeção:

```text
artifact_tables=1
artifact_columns=23
```

Check crítico validado:

```text
ready checksum check enforced
```

