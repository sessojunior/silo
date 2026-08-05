# Fase 3.2 — Snapshot local reproduzível do schema

Data: 2026-07-22

## Objetivo

Capturar o snapshot local reproduzível antes de modelar SQLAlchemy/Alembic.

Esta etapa foi limitada a inventário de fontes versionadas e consultas somente leitura contra o banco Compose local disponível. Não foram executados DDL, `alembic stamp`, seed, backup, restore, `drizzle-kit push`, migration ou consulta em staging/produção.

## Fontes versionadas capturadas

Fontes de schema/configuração:

- `packages/db/src/schema.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/drizzle.config.ts`

Migrations SQL Drizzle versionadas:

- `packages/db/drizzle/0000_tranquil_demogoblin.sql`
- `packages/db/drizzle/0001_kafka_processed_messages.sql`
- `packages/db/drizzle/0002_product_availability_exceptions.sql`
- `packages/db/drizzle/0003_ai_assistant_threads.sql`
- `packages/db/drizzle/0004_ai_assistant_generation_metadata.sql`
- `packages/db/drizzle/0005_simplify_permissions.sql`
- `packages/db/drizzle/0006_add_group_permissions_default_uuid.sql`
- `packages/db/drizzle/0007_pgvector_embeddings.sql`
- `packages/db/drizzle/0008_rag_enhancements.sql`

Seeds e reset versionados:

- `packages/db/src/seed-data.ts`
- `packages/db/src/seed-pictures.ts`
- `packages/db/src/seed-radars.ts`
- `packages/db/src/seed-types.ts`
- `packages/db/src/seed-utils.ts`
- `packages/db/src/seed.ts`
- `packages/db/src/reset.ts`

Fixtures SQL locais:

- `tests/fixtures/legacy-db/seed-contract-ai-assistant.sql`
- `tests/fixtures/legacy-db/seed-contract-auth-flows.sql`
- `tests/fixtures/legacy-db/seed-contract-chat-realtime.sql`
- `tests/fixtures/legacy-db/seed-contract-domain.sql`
- `tests/fixtures/legacy-db/seed-contract-email.sql`
- `tests/fixtures/legacy-db/seed-contract-mutation-success.sql`
- `tests/fixtures/legacy-db/seed-contract-rag-cache.sql`
- `tests/fixtures/legacy-db/seed-contract-status-semantics.sql`
- `tests/fixtures/legacy-db/seed-contract-users.sql`
- `tests/fixtures/legacy-db/seed-contract-worker-kafka.sql`

Fixture IA:

- `apps/backend/tests/fixtures/ai/eval-cases.jsonl`

Hash SHA-256 do conjunto versionado inventariado: `66ea397fa8b8a89eba188574ed27a7065213c42cf8053c61453fda9e36d2fb8e`.

## Schema material do Drizzle

`packages/db/drizzle.config.ts` aponta para `schema: "./src/schema/index.ts"`.

`packages/db/src/schema/index.ts` reexporta `../schema`, portanto a fonte material que deve guiar a modelagem SQLAlchemy inicial é `packages/db/src/schema.ts`.

Resumo do schema versionado:

- 40 declarações `pgTable`;
- tipo customizado `vector(768)`;
- 28 índices declarados no schema TypeScript;
- 7 constraints unique declaradas no schema TypeScript.

Tabelas declaradas no schema TypeScript:

- `group`
- `user_group`
- `group_permissions`
- `user`
- `session`
- `account`
- `verification`
- `rate_limit`
- `user_profile`
- `user_preferences`
- `product`
- `product_availability_exception`
- `picture_page`
- `picture_link`
- `radar_group`
- `radar`
- `product_problem_category`
- `product_problem`
- `product_problem_image`
- `product_solution`
- `product_solution_checked`
- `product_solution_image`
- `product_dependency`
- `contact`
- `product_contact`
- `product_manual`
- `product_manual_chunk`
- `chat_message`
- `chat_user_presence`
- `ai_assistant_thread`
- `ai_assistant_message`
- `help`
- `project`
- `project_activity`
- `project_task`
- `project_task_user`
- `project_task_history`
- `product_activity`
- `product_activity_history`
- `kafka_processed_messages`

## Extensões esperadas pelas migrations versionadas

As migrations SQL versionadas declaram:

- `pgcrypto` em `0006_add_group_permissions_default_uuid.sql`;
- `vector` em `0007_pgvector_embeddings.sql`;
- `vector` e `pg_trgm` em `0008_rag_enhancements.sql`.

Uso de vetores e índices versionados:

- embeddings `vector(768)` para conteúdo RAG;
- índices HNSW em campos vetoriais;
- índices GIN/trigram para busca textual em melhorias RAG.

## Status/semântica versionada

A matriz canônica de status de execução de modelo está versionada em:

- `docs/migration/ai/model-run-status-semantics.yaml`

Ela deve ser usada nas fases posteriores para impedir que a modelagem Python interprete status como `pending`, `off`, incidente, disponibilidade ou terminalidade por inferência implícita.

## Banco Compose local

`docker compose ps db` indicou o serviço local `silo-db` em execução com imagem `pgvector/pgvector:pg17`, porta local `5432`, estado `Up`.

As consultas de fingerprint foram somente leitura e limitaram-se a metadados:

- `pg_extension`;
- `information_schema.tables`;
- `information_schema.columns`;
- `pg_indexes`;
- `information_schema.table_constraints`;
- `pg_stat_user_tables` para contagem aproximada de linhas vivas.

Nenhum conteúdo de linha de negócio foi exportado.

Resultado do fingerprint local:

- SHA-256 canônico do fingerprint local: `f087963b33b47ed52b17b28482bbc977097319873f019aba5164dcadbddc88ba`;
- extensões observadas: `plpgsql=1.0`, `vector=0.8.3`;
- tabelas observadas: 40;
- colunas observadas: 323;
- índices observados: 83;
- constraints observadas: 341;
- linhas vivas aproximadas: 14.

Tabelas observadas no banco Compose local:

- `account`
- `ai_assistant_message`
- `ai_assistant_thread`
- `chat_message`
- `chat_user_presence`
- `contact`
- `group`
- `group_permissions`
- `help`
- `kafka_processed_messages`
- `picture_link`
- `picture_page`
- `product`
- `product_activity`
- `product_activity_history`
- `product_availability_exception`
- `product_contact`
- `product_dependency`
- `product_manual`
- `product_manual_chunk`
- `product_problem`
- `product_problem_category`
- `product_problem_image`
- `product_solution`
- `product_solution_checked`
- `product_solution_image`
- `project`
- `project_activity`
- `project_task`
- `project_task_history`
- `project_task_user`
- `radar`
- `radar_group`
- `rate_limit`
- `session`
- `user`
- `user_group`
- `user_preferences`
- `user_profile`
- `verification`

As 40 tabelas observadas no banco Compose local correspondem ao conjunto de 40 tabelas declarado em `packages/db/src/schema.ts`.

## Riscos de drift registrados para a Fase 3.3

1. As migrations versionadas esperam `pgcrypto`, `vector` e `pg_trgm`, mas o fingerprint local observou apenas `plpgsql` e `vector=0.8.3`. A ausência local observada de `pg_trgm` e `pgcrypto` deve ser analisada na Fase 3.3 antes de modelar Alembic.
2. `packages/db/src/schema.ts` e o banco Compose local concordam no conjunto de tabelas, mas isso não prova produção. Staging/produção real continuam pendentes para o Subgate 3B.
3. O entrypoint legado já registrado na Fase 3.1 ainda contém risco de DDL/seed automático (`__drizzle_migrations`, `drizzle-kit push`, `db:seed`) e deve ser tratado nas fases 3.16 e 3.17.
4. O banco local contém poucas linhas vivas aproximadas. Ele serve para fingerprint estrutural local, não para validar distribuição, cardinalidade, performance ou dados de negócio reais.

## Comandos executados

Todos os comandos foram de leitura/inventário:

```powershell
rg --files packages/db tests/fixtures apps/backend -g "*.ts" -g "*.sql" -g "*.json" -g "*.jsonl"
rg -n "CREATE EXTENSION|vector\\(|pg_trgm|pgcrypto|hnsw|gin|status|enum" packages/db docs/migration/ai/model-run-status-semantics.yaml
docker compose ps db
docker compose exec -T db psql -U silo -d silo -At -c "<consultas somente leitura em pg_catalog/information_schema>"
```

Duas falhas transitórias ocorreram durante a construção local do comando de fingerprint e foram corrigidas sem alterar estado:

- warnings de variáveis não definidas do Compose interferiram na primeira tentativa de automação PowerShell;
- `SHA256.HashData` não estava disponível no runtime PowerShell/.NET usado; a automação foi ajustada para `SHA256.Create().ComputeHash`.

Essas falhas foram de automação local, não de schema, e não executaram DDL.

## Resultado

Fase 3.2 concluída para avanço local: snapshot versionado e fingerprint do banco Compose local foram capturados. O drift de extensões fica explicitamente aberto para a Fase 3.3, conforme o plano.
