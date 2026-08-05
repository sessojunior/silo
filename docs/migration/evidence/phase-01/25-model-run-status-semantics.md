# Fase 1.25 — Matriz canônica de status de rodada

Data: 2026-07-22

## Artefatos criados

- Matriz canônica: `docs/migration/ai/model-run-status-semantics.yaml`
- Assertor: `tests/contracts/legacy/assert-model-run-status-semantics.mjs`

## Fontes usadas

- Schema Drizzle: `packages/db/src/schema.ts`
- Engine constants: `packages/engine/src/domain/product-status.ts`
- Report service: `apps/api/src/services/report-service.ts`
- Dashboard service: `apps/api/src/services/dashboard-service.ts`
- Categoria sem incidente: `packages/engine/src/config/constants.ts`
- Fixture cruzada da Fase 1.24:
  - `tests/fixtures/legacy-db/seed-contract-status-semantics.sql`
  - `tests/fixtures/legacy-golden/phase1_24.status_semantics_cross_fixture.json`
- Amostra local anonimizada por agregados no banco Docker Compose `silo`.

## Amostra anonimizada real/local

A consulta exportou somente contagens agregadas, sem IDs, usuários, descrições, payloads ou textos:

```json
{
  "activity_status_counts": {
    "not_run": 1,
    "suspended": 2,
    "with_problems": 1
  },
  "product_activity_table": "product_activity",
  "activity_no_incidents_count": 0,
  "activity_null_category_count": 0,
  "registered_problem_no_incidents_count": 1,
  "registered_problem_null_category_count": 0
}
```

## Decisões explícitas

- `pending`: não executou, não é incidente, não é terminal, não entra no denominador de disponibilidade. Divergência legada: report/dashboard contam `pending` como falha/alerta.
- `off`: status legado citado no comentário do schema, não no union `ProductStatus`. É lido de dados existentes, não é incidente, não é execução, é terminal e não entra em disponibilidade. Novas APIs Python não devem escrever `off` antes de decisão posterior.
- `no_incidents`: a categoria nunca transforma uma linha em incidente real.

## Owner

Owner registrado: `migration-executor`.

Justificativa: não há owner externo versionado no repositório nem disponível no plano atual. A aprovação fica controlada pelo próprio plano de migração e pelo executor, com evidência versionada para revisão humana posterior, sem deixar `pending` ou `off` implícitos.

## Validação executada

```text
node --check tests/contracts/legacy/assert-model-run-status-semantics.mjs
OK

node tests/contracts/legacy/assert-model-run-status-semantics.mjs
phase1_25 model run status semantics OK
```
