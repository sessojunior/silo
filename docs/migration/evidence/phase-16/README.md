# Fase 16 - Cutover de producao

Evidencia local do suporte criado para o cutover:

- `scripts/deploy/cutover-runbook.mjs` implementa `preflight`, `rehearsal`, `cutover` e `rollback`.
- `package.json` expoe `deploy:preflight`, `deploy:rehearsal`, `deploy:cutover` e `deploy:rollback`.
- `docs/migration/phase-16-runbook.md` documenta os parametros do estado de entrada e os criterios de execucao.
- `tests/contracts/legacy/assert-phase14-16-support.mjs` valida os artefatos e o contrato do cutover.
- Os scripts de load/soak e o contrato de chaos da fase 14 continuam disponiveis para a validacao prolongada.

Os passos que dependem da janela real de producao, backup restaurado, DNS/route e observacao de 24 h continuam bloqueados por ambiente externo e nao foram executados como conclusao definitiva neste repositório.
