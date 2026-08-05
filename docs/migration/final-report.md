# Final Report da Migracao

Este relatorio consolida o estado final da migracao Python/FastAPI e a limpeza
do legado Node. O repositorio ficou consolidado e os suportes operacionais de
carga, soak, cutover, rollback e chaos estao versionados; os passos que
dependem de staging/producao real foram documentados como runbooks externos e
nao permanecem no backlog ativo do projeto.

## Resumo tecnico

- Backend Python/FastAPI, worker Python e frontend Next.js em operacao na stack
  atual.
- A composicao npm ativa foi reduzida para `apps/frontend`, `packages/config`
  e `packages/engine`.
- `packages/engine` manteve apenas a superficie compartilhada usada pelo web.
- O worker legado Node, `apps/api`, `apps/worker`, `packages/db` e os
  Dockerfiles Node foram removidos do tree de trabalho.
- Fluxos Kafka/data-flow usam o feed SMNA compartilhado e mantem fallback
  offline local.
- Scripts e contratos de load, soak, deploy, SBOM, audit e chaos estao
  disponiveis no repositorio.
- Os contratos de suporte fase 14-16 e fase 17 passaram no checkout atual.

## Resultados atuais

- Suite backend: `442 passed, 2 skipped`.
- Cobertura Python: `90.00%`.
- Gate de cobertura: aprovado.
- Contratos de suporte fase 14-16: aprovado.
- Contrato de suporte fase 17: aprovado.

## Debitos e owners

| Debito | owner |
| --- | --- |
| Execucao real de carga e soak em staging | plataforma/staging |
| Cutover e rollback de producao | operacao |
| Janela formal de observacao prolongada | operacao |
| Ultima validacao externa de trafego | migration-executor |

## Operacao externa

- Execucao real de carga e soak em staging.
- Cutover e rollback em producao.
- Janela formal de observacao prolongada e checagens diarias.

## Observacao final

O repositorio agora contem apenas o que e necessario para executar e validar a
stack Python localmente. A operacao externa continua documentada em
`scripts/deploy/cutover-runbook.mjs`, `scripts/load/run-http-benchmark.mjs`,
`scripts/load/run-soak-benchmark.mjs` e `docs/migration/phase-16-runbook.md`.
