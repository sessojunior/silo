# Evidencia da Fase 17

Esta pasta registra o suporte local construido para a limpeza do legado Node.
Ela documenta o que ficou pronto para a fase final de observacao e removeu do
tree de trabalho os artefatos Node/Drizzle antigos.

## O que ja foi consolidado localmente

- O worker legado em `apps/worker/src/index.ts` foi removido junto com o resto
  da arvore Node antiga.
- `docker-compose.yml` e `docker-compose.deploy.yml` nao passam mais envs de
  Ollama para o worker.
- `tests/contracts/legacy/assert-phase17-support.mjs` valida a remocao dessa
  arvore antiga e o novo estado da stack.
- `docs/migration/archive/legacy-golden-index.md` documenta os goldens
  preservados e o ponto unico de referencia historica.
- `docs/migration/archive/migration-policy.md` registra a regra para futuras
  migrations nao aditivas.
- `docs/migration/archive/README.md` registra o indice do legado preservado.
- `docs/migration/final-report.md` consolida o relatorio atual da migracao.
- `thinking` continua opcional no DTO legado de compatibilidade.
- `checkpointer` continua fora de escopo no backend Python atual.
- `package.json` e `package-lock.json` foram enxugados para manter somente
  `apps/frontend`, `packages/config` e `packages/engine` na composicao npm
  ativa.
- `packages/engine/package.json` e `packages/engine/src/contracts/index.ts`
  nao expoem mais helpers server-only de `config`, `auth`, `email`, `kafka` ou
  `kafka-events`.
- `package.json` passou a expor apenas os scripts web no bloco raiz e os
  comandos de banco agora apontam para Python/Alembic.
- `apps/frontend/package.json` nao depende mais de `better-auth` e o pacote
  compartilhado foi enxugado removendo config/auth/email/Kafka server-only.
- `apps/frontend/src/proxy.ts` agora aceita somente `silo_session` e nao
  carrega mais cookies Better Auth no web.
- `tsconfig.json` ficou restrito aos workspaces ativos do frontend e engine.
- `entrypoint-api.sh`, os Dockerfiles Node de `apps/api` e `apps/worker` e as
  arvores antigas de `apps/api`, `apps/worker` e `packages/db` foram
  removidos.

## O que ainda depende de janela formal

- Arquivamento total dos goldens Node.
- Confirmacao final de que as referencias historicas restantes nao sao mais
  usadas por nenhuma rota ativa.
