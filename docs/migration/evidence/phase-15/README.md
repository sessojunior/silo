# Fase 15 - Ensaio completo em staging

Evidencia local do ensaio preparado no repositório:

- `docker-compose.migration.yml` para coexistencia Node/Python.
- `docker-compose.deploy.yml` para a stack final Python.
- `scripts/deploy/cutover-runbook.mjs` com modo `rehearsal` para a sequencia de staging.
- `npm run deploy:rehearsal`, `npm run deploy:cutover` e `npm run deploy:rollback` para a operacao repetivel.
- `tests/contracts/legacy/assert-phase14-16-support.mjs` para manter o suporte de fase 14-16 validado.
- validações do browser contra a API Python em `/silo` e `/`.
- suporte a auth, uploads, reports, chat, monitoring, assistant e worker Python.
- testes para continuidade de conversas, logging sanitizado e contratos do worker.
- contratos auxiliares para threat model, observabilidade e chaos em `docs/migration/ai/`.

Os passos que dependem de uma copia real de staging/producao, janela de 7 dias ou observacao prolongada permanecem bloqueados por ambiente externo e nao foram simulados como conclusao definitiva.
