# Fase 3.1 — Decisão operacional para execução local sem dados reais

Data: 2026-07-22

## Objetivo

Registrar a decisão operacional de que a ausência de dados, logs ou telemetria reais de staging/produção não bloqueia a execução local da Fase 3.

Esta etapa não executa DDL, `stamp`, seed, backup, restore ou consulta em staging/produção.

## Decisão

A Fase 3 pode avançar localmente usando fontes versionadas e reproduzíveis do repositório. Isso permite modelar SQLAlchemy/Alembic, preparar scripts, validar contratos locais e construir o baseline sem depender de acesso externo que o executor não possui.

Controles obrigatórios:

- produção permanece somente leitura até a Fase 16;
- nenhum `alembic stamp`, DDL, seed ou migration é executado em produção nesta fase;
- staging/produção reais continuam necessários para backup, fingerprint real, restore descartável, `stamp` em staging/restore e Subgate 3B;
- qualquer drift que só possa ser decidido por produção real deve ser registrado como pendência do Subgate 3B, não resolvido por suposição;
- nunca declarar produção validada sem evidência real.

## Fontes locais autorizadas para iniciar a Fase 3

Fontes de schema/versionamento encontradas:

- `packages/db/src/schema.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/drizzle.config.ts`
- `packages/db/drizzle/meta/_journal.json`
- `packages/db/drizzle/meta/0000_snapshot.json`
- 9 migrations SQL em `packages/db/drizzle/*.sql`:
  - `0000_tranquil_demogoblin.sql`
  - `0001_kafka_processed_messages.sql`
  - `0002_product_availability_exceptions.sql`
  - `0003_ai_assistant_threads.sql`
  - `0004_ai_assistant_generation_metadata.sql`
  - `0005_simplify_permissions.sql`
  - `0006_add_group_permissions_default_uuid.sql`
  - `0007_pgvector_embeddings.sql`
  - `0008_rag_enhancements.sql`

Observação: `packages/db/drizzle.config.ts` aponta `schema: "./src/schema/index.ts"`, e `packages/db/src/schema/index.ts` reexporta `../schema`. Portanto, a Fase 3.2 deve tratar `packages/db/src/schema.ts` como fonte material e `packages/db/src/schema/index.ts` como entrada configurada do Drizzle.

Fontes de seed/fixtures encontradas:

- seeds TypeScript em `packages/db/src/seed*.ts`;
- `packages/db/src/reset.ts`;
- 10 fixtures SQL em `tests/fixtures/legacy-db/*.sql`;
- 642 goldens em `tests/fixtures/legacy-golden/`;
- corpus IA em `apps/backend/tests/fixtures/ai/eval-cases.jsonl`.

Fonte local opcional:

- `docker compose ps db` mostrou o serviço `silo-db` em execução, usando imagem `pgvector/pgvector:pg17`, com porta local `5432`.
- A Fase 3.1 não consultou esse banco. A captura/fingerprint local fica para a Fase 3.2.

## Comandos de inventário executados

Todos os comandos foram somente leitura:

```powershell
rg --files packages/db
rg --files tests\fixtures packages apps\api apps\worker -g "*seed*" -g "*.sql" -g "*.json" -g "*.jsonl"
docker compose ps db
Get-Content packages\db\package.json
Get-Content packages\db\drizzle.config.ts
Get-Content packages\db\src\schema.ts | Select-Object -First 60
Get-Content packages\db\src\schema\index.ts | Select-Object -First 60
rg -n "drizzle-kit push|__drizzle_migrations|db:push|db:seed|db:migrate|drizzle-kit migrate|drizzle-kit generate|SKIP_DB_SYNC" entrypoint-api.sh docker-compose.yml package.json packages\db apps\api -g "!**/node_modules/**"
```

## Riscos registrados para as próximas etapas

- O entrypoint legado `entrypoint-api.sh` remove `__drizzle_migrations`, executa `drizzle-kit push` e tenta `db:seed`; isso confirma o risco já descrito no plano e deve ser tratado nas fases 3.16 e 3.17.
- Os arquivos SQL e snapshots Drizzle não provam sozinhos o schema real de produção.
- Sem produção/staging reais, qualquer diferença entre schema versionado e schema real fica pendente para Subgate 3B.
- O banco Compose local está disponível, mas só pode ser usado na Fase 3.2 para snapshot local reproduzível, não como prova de produção.

## Resultado

Fase 3.1 concluída.

Próxima etapa: Fase 3.2 — capturar snapshot local reproduzível com as fontes versionadas e, se apropriado, fingerprint do banco Compose local.
