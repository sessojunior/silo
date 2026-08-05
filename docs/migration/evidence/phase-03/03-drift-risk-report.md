# Fase 3.3 — Relatório de riscos de drift local/versionado

Data: 2026-07-22

## Objetivo

Comparar as fontes versionadas do banco, o schema Drizzle, as migrations SQL, o código que usa queries/SQL bruto e os goldens/fixtures antes de iniciar a modelagem SQLAlchemy.

Esta etapa não executou DDL, seed, `stamp`, backup, restore, `drizzle-kit push`, migration ou consulta em staging/produção. As consultas ao banco Compose local foram somente leitura e restritas a catálogo/metadados.

## Fontes comparadas

Fontes versionadas principais:

- `packages/db/src/schema.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/drizzle.config.ts`
- `packages/db/drizzle/*.sql`
- `packages/db/drizzle/meta/_journal.json`
- `tests/fixtures/legacy-db/*.sql`
- `tests/fixtures/legacy-golden/*.json`
- `tests/contracts/legacy/*.json`
- `docs/migration/evidence/phase-01/17-ai-rag-cache.md`
- `docs/migration/ai/model-run-status-semantics.yaml`

Código com SQL bruto ou fragmentos SQL relevantes:

- `apps/api/src/services/ai-assistant-rag-service.ts`
- `apps/api/src/services/ai-assistant-cache-service.ts`
- `apps/api/src/services/embedding-write-service.ts`
- `apps/api/src/scripts/backfill-embeddings.ts`
- `apps/api/src/infra/rate-limit-db.ts`
- `apps/api/src/services/ai-assistant-thread-service.ts`
- `apps/api/src/services/group-service.ts`
- `apps/api/src/services/product-solution-service.ts`
- `apps/api/src/services/report-service.ts`
- `packages/db/run-migration.ts`
- `packages/db/src/reset.ts`
- `packages/db/src/seed.ts`

Banco local observado:

- serviço Compose `silo-db`;
- imagem `pgvector/pgvector:pg17`;
- fingerprint da Fase 3.2: `f087963b33b47ed52b17b28482bbc977097319873f019aba5164dcadbddc88ba`.

## Resultado da comparação schema Drizzle vs banco Compose local

`packages/db/src/schema.ts` e o banco Compose local concordam estruturalmente em tabelas e colunas:

- tabelas no schema: 40;
- tabelas no banco local: 40;
- colunas parseadas do schema: 323;
- colunas no banco local: 323;
- tabelas somente no schema: nenhuma;
- tabelas somente no banco local: nenhuma;
- colunas somente no schema: nenhuma;
- colunas somente no banco local: nenhuma.

Os 28 índices explícitos declarados em `schema.ts` existem no banco local.

As 7 constraints unique declaradas em `schema.ts` também existem localmente como índices unique.

Decisão: para tabelas, colunas, constraints unique e índices explícitos do `schema.ts`, a modelagem SQLAlchemy deve seguir `packages/db/src/schema.ts` e preservar os nomes físicos atuais. Não há conflito local bloqueante nessa camada.

## Drift 3.3-001 — Journal Drizzle incompleto para SQL manuais

`packages/db/drizzle/meta/_journal.json` lista apenas:

- `0000_tranquil_demogoblin`;
- `0001_kafka_processed_messages`;
- `0002_product_availability_exceptions`;
- `0003_ai_assistant_threads`;
- `0004_ai_assistant_generation_metadata`.

Porém existem SQL versionados adicionais:

- `0005_simplify_permissions.sql`;
- `0006_add_group_permissions_default_uuid.sql`;
- `0007_pgvector_embeddings.sql`;
- `0008_rag_enhancements.sql`.

O entrypoint legado usa `drizzle-kit push`, remove `__drizzle_migrations` e executa seed automaticamente. Portanto, o banco local atual não deve ser interpretado como resultado confiável de replay do journal Drizzle.

Decisão: a baseline Alembic não deve ser derivada apenas do `_journal.json`. A fonte determinística para modelagem é:

1. `packages/db/src/schema.ts` para tabelas, colunas, FKs, defaults, constraints e índices explícitos;
2. SQL versionados `0007` e `0008` para extensões e índices RAG/vetoriais/trigram;
3. SQL versionado `0006` para preservar default `gen_random_uuid()`;
4. goldens/fixtures para semântica de uso e nomes físicos exercitados.

## Drift 3.3-002 — Migration `0005_simplify_permissions.sql`

`0005_simplify_permissions.sql` introduz `resource_v2` e `action_v2`, cria índices/unique v2 e usa `FROM groups g`.

Conflitos observados:

- a tabela física versionada e local é `"group"`, não `groups`;
- `schema.ts` não define `resource_v2` nem `action_v2`;
- o banco Compose local não possui `resource_v2` nem `action_v2`;
- os goldens e fixtures usam `group_permissions.resource` e `group_permissions.action`;
- o código atual (`group-service.ts` e `permissions.ts`) lê e escreve `resource/action`.

Estado local de `group_permissions`:

- colunas: `id`, `group_id`, `resource`, `action`, `created_at`, `updated_at`;
- default de `id`: `gen_random_uuid()`;
- unique atual: `unique_group_permission` em `(group_id, resource, action)`;
- índices atuais: `idx_group_permission_group_id`, `idx_group_permission_resource`.

Decisão: a baseline SQLAlchemy deve modelar `group_permissions` exatamente como o estado atual de `schema.ts`/banco local/goldens: sem `resource_v2` e sem `action_v2`.

`0005_simplify_permissions.sql` fica classificada como histórico divergente/manual que não deve ser reproduzido na baseline Python. Se staging/produção real contiver `resource_v2` ou `action_v2`, o Subgate 3B deve parar o fluxo e exigir decisão explícita de reconciliação antes de `stamp`, staging ou cutover.

## Drift 3.3-003 — Extensões e índices RAG/vetoriais

As migrations versionadas declaram:

- `pgcrypto` em `0006_add_group_permissions_default_uuid.sql`;
- `vector` em `0007_pgvector_embeddings.sql`;
- `vector` e `pg_trgm` em `0008_rag_enhancements.sql`.

O banco Compose local expõe:

- `plpgsql=1.0`;
- `vector=0.8.3`;
- `gen_random_uuid()` disponível;
- `vector_dims(vector)` disponível;
- `similarity(text,text)` indisponível;
- `pg_trgm` ausente;
- `pgcrypto` ausente como extensão instalada.

Colunas `embedding` existem localmente em:

- `ai_assistant_message`;
- `help`;
- `product_manual_chunk`;
- `product_problem`;
- `product_solution`.

Índices RAG/vetoriais/trigram esperados por `0007`/`0008`, mas ausentes no banco Compose local:

- `idx_ai_message_embedding`;
- `idx_product_problem_embedding`;
- `idx_product_solution_embedding`;
- `idx_product_manual_chunk_embedding`;
- `idx_product_manual_chunk_product_id`;
- `idx_product_manual_chunk_content_trgm`;
- `idx_help_embedding`;
- `idx_product_problem_title_trgm`;
- `idx_product_problem_description_trgm`;
- `idx_product_solution_description_trgm`.

Decisão:

- a baseline Alembic deve criar `vector`, `pg_trgm` e `pgcrypto` de forma idempotente;
- a baseline Alembic deve criar todos os índices RAG/vetoriais/trigram versionados em `0007` e `0008`;
- o banco Compose local atual não é fonte canônica para decidir ausência desses índices, porque ele foi sincronizado por `drizzle-kit push`/schema e não por replay confiável de todos os SQL manuais;
- qualquer `stamp` em banco existente deve ser bloqueado se `pg_trgm` ou os índices RAG esperados estiverem ausentes, até que uma migration aditiva ou baseline reconciliada resolva o delta em ambiente descartável.

Essa decisão resolve o conflito local para modelagem: a SQLAlchemy/Alembic deve representar a intenção completa versionada, não apenas o estado parcial do Compose atual.

## Drift 3.3-004 — SQL bruto de RAG/cache/embeddings

O código legado usa SQL bruto para operações que Drizzle não modela bem:

- operador pgvector `<=>`;
- cast `::vector`;
- função `similarity()` de `pg_trgm`;
- `vector_dims()`;
- updates/inserts de embeddings;
- chunks em `product_manual_chunk`;
- cache semântico por usuário em `ai_assistant_message` + `ai_assistant_thread`.

Risco funcional observado e já congelado na Fase 1.17:

- algumas queries de `ai-assistant-rag-service.ts` retornam aliases snake_case como `vector_similarity`, `trigram_similarity`, `hybrid_score` e `product_id`;
- o mapper TypeScript lê propriedades camelCase como `vectorSimilarity`, `trigramSimilarity`, `hybridScore` e `productId`;
- a evidência `docs/migration/evidence/phase-01/17-ai-rag-cache.md` registra que o SQL encontra problemas/soluções, mas o serviço observado retorna vazio nessas fontes.

Decisão:

- a modelagem SQLAlchemy deve expor os campos físicos reais, em snake_case no banco;
- a implementação Python não deve inferir schema a partir dos tipos TypeScript declarados para `db.execute`;
- as queries Python devem usar aliases coerentes com o mapper Python ou mapear explicitamente snake_case para DTOs;
- a Python API não deve reproduzir `sql.raw` com interpolação manual de IDs/texto; usar parâmetros vinculados e adaptador/serialização vetorial segura;
- a compatibilidade com goldens deve distinguir defeito legado congelado de contrato a preservar, conforme já definido na Fase 1.17 e nas fases de IA posteriores.

## Drift 3.3-005 — Fixtures e goldens

Os 10 arquivos SQL em `tests/fixtures/legacy-db/*.sql` tocam somente tabelas existentes no schema atual. Nenhum `INSERT`, `DELETE` ou `UPDATE` real referencia tabela desconhecida.

Tabelas exercitadas por fixtures:

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

Goldens relevantes confirmam:

- permissões baseadas em `group_permissions.resource/action`;
- embeddings com dimensão 768;
- `product_manual_chunk` como tabela física atual;
- cache semântico isolado por usuário;
- semântica de status em `docs/migration/ai/model-run-status-semantics.yaml`.

Decisão: fixtures/goldens não introduzem tabela extra para a baseline. Eles devem ser usados depois para validar serializer, queries e semântica, não para alterar nomes físicos do schema.

## Pendências reais para Subgate 3B

As seguintes perguntas não podem ser encerradas sem staging/produção real ou cópia sanitizada:

1. produção possui `resource_v2`/`action_v2` apesar de schema/local/goldens não possuírem?
2. produção possui `pg_trgm` e os índices RAG/trigram?
3. produção possui `pgcrypto` instalado ou apenas `gen_random_uuid()` disponível?
4. existem grants, owners, triggers, views ou sequences fora das fontes versionadas?
5. existem índices manuais não versionados em produção?
6. há divergência de constraints/FKs/defaults causada por `drizzle-kit push` ou migrations manuais?

Essas pendências não bloqueiam as fases locais 3.4–14, mas bloqueiam Subgate 3B, Fase 15, Fase 16, `stamp` real e qualquer troca de tráfego.

## Comandos executados

Todos os comandos foram somente leitura:

```powershell
rg -n "pgTable|index|unique|customType" packages/db/src/schema.ts
rg -n "CREATE TABLE|ALTER TABLE|CREATE INDEX|CREATE EXTENSION|vector|pg_trgm|pgcrypto" packages/db/drizzle -g "*.sql"
rg -n "sql`|db.execute|sql.raw|<=>|similarity|vector_dims" apps/api/src packages/db -g "*.ts"
docker compose exec -T db psql -U silo -d silo -At -c "<consultas somente leitura em information_schema/pg_catalog>"
```

Consultas locais executadas:

- colunas por tabela em `information_schema.columns`;
- índices em `pg_indexes`;
- extensões em `pg_extension`;
- funções via `to_regprocedure`;
- defaults de `group_permissions.id`.

## Resultado

Fase 3.3 concluída para avanço local.

Conflitos locais encontrados foram resolvidos por decisões vinculantes de fonte de verdade para a modelagem:

- `0005_simplify_permissions.sql` não entra na baseline Python como estado final;
- `resource_v2/action_v2` ficam excluídos da baseline local;
- `vector`, `pg_trgm`, `pgcrypto` e os índices RAG de `0007`/`0008` entram na baseline Alembic;
- o banco Compose atual é aceito como evidência de tabelas/colunas, mas não como fonte única para extensões/índices RAG;
- SQL bruto de RAG/embedding deve ser portado com parâmetros seguros e aliases explícitos.

Não há bloqueio para iniciar a Fase 3.4. O Subgate 3B permanece obrigatório antes de qualquer staging/cutover, `stamp` real ou troca de tráfego.
