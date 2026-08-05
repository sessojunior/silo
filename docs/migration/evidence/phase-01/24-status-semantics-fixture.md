# Fase 1.24 — Fixture cruzada de status, problemas, soluções e checks

Data: 2026-07-22

## Artefatos criados

- Seed SQL: `tests/fixtures/legacy-db/seed-contract-status-semantics.sql`
- Expectations manuais: `tests/fixtures/legacy-golden/phase1_24.status_semantics_cross_fixture.json`
- Assertor: `tests/contracts/legacy/assert-status-semantics-fixture.mjs`
- README atualizado: `tests/fixtures/legacy-db/README.md`

## Cobertura congelada

- Produtos dedicados: `phase1-24-product-alpha` e `phase1-24-product-beta`.
- Atividades: 9 linhas em `product_activity`.
- Histórico: 9 linhas em `product_activity_history`, uma por atividade.
- Status cobertos:
  - `completed`
  - `with_problems`
  - `run_again`
  - `not_run`
  - `under_support`
  - `suspended`
  - `in_progress`
  - `pending`
  - `off`, como candidato legado citado no comentário do schema, não no union do engine.
- Turnos cobertos: 0, 6, 12 e 18.
- Períodos cobertos: `2026-07-21` e `2026-07-14`.
- Intervenção coberta como string vazia, `NULL` e texto não vazio.
- Categorias cobertas: três categorias reais da fixture e `no_incidents`.
- Problemas formais:
  - um problema sem solução;
  - um problema com uma solução e um check;
  - um problema com duas soluções e dois checks;
  - um problema em categoria `no_incidents`, excluído das métricas de problema real.

## Expectativas manuais

As expectations não resolvem definitivamente a semântica de `pending` e `off`; elas registram a divergência atual:

- `packages/engine/src/domain/product-status.ts` não inclui `pending` em `INCIDENT_STATUS`.
- `apps/api/src/services/report-service.ts` inclui `pending` como falha de disponibilidade.
- `apps/api/src/services/dashboard-service.ts` inclui `pending` como alerta.
- `off` aparece no comentário do schema de `product_activity.status`, mas não no union `ProductStatus`.

Essa divergência fica preparada para decisão canônica na Fase 1.25.

## Validação executada

```text
node --check tests/contracts/legacy/assert-status-semantics-fixture.mjs
OK

node tests/contracts/legacy/assert-status-semantics-fixture.mjs
phase1_24 status semantics fixture OK

Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-users.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
COMMIT

Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-status-semantics.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
COMMIT
```

Consulta de cobertura no PostgreSQL:

```json
{
  "dates": ["2026-07-14", "2026-07-21"],
  "turns": [0, 6, 12, 18],
  "statuses": [
    "completed",
    "in_progress",
    "not_run",
    "off",
    "pending",
    "run_again",
    "suspended",
    "under_support",
    "with_problems"
  ],
  "history_count": 9,
  "problem_count": 4,
  "activity_count": 9,
  "checked_counts": [0, 0, 1, 2],
  "solution_counts": [0, 1, 1, 2],
  "non_empty_interventions": 3,
  "no_incidents_activity_rows": 2,
  "empty_or_null_interventions": 6
}
```

Os avisos do Docker Compose sobre variáveis Kafka/PRODUCT_FLOW ausentes são os mesmos avisos benignos já observados nas fases anteriores e os comandos terminaram com exit 0.
