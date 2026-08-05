# Fase 1.4 — runner de contrato legado

Data: 2026-07-21  
Status: concluído com captura bootstrap real contra API Node temporária em `127.0.0.1:4000`.

## Artefatos criados

- `tests/contracts/legacy/runner.mjs`
- `tests/contracts/legacy/external-stub-server.mjs`
- `tests/contracts/legacy/cases.bootstrap.json`
- `tests/fixtures/legacy-golden/system.health.ok.json`

## Script raiz

- `npm run contract:legacy -- --cases=tests/contracts/legacy/cases.bootstrap.json`

## Evidências de execução

- `docs/migration/evidence/phase-01/04-runner-bootstrap.stdout.log`
- `docs/migration/evidence/phase-01/04-runner-bootstrap.stderr.log`
- `docs/migration/evidence/phase-01/04-api-node.stdout.log`
- `docs/migration/evidence/phase-01/04-api-node.stderr.log`
- `docs/migration/evidence/phase-01/04-external-stub.stdout.log`
- `docs/migration/evidence/phase-01/04-external-stub.stderr.log`

## Comandos validados

```powershell
node --check tests/contracts/legacy/runner.mjs
node --check tests/contracts/legacy/external-stub-server.mjs
npm run contract:legacy -- --dry-run
```

Também foi executada captura real do caso bootstrap `system.health.ok`, iniciando temporariamente:

- stub externo HTTP em `127.0.0.1:11435`;
- API Node via `node node_modules/tsx/dist/cli.mjs apps/api/src/index.ts`;
- runner contra `http://127.0.0.1:4000`.

## Correção feita durante a etapa

O runner inicialmente tentava abrir PostgreSQL sempre que havia `DRIZZLE_DATABASE_URL`, mesmo para casos sem snapshots SQL. Isso bloqueava `/health` quando o banco fixture ainda não estava rodando. A correção foi restringir conexão DB a casos que declaram `sideEffects.dbBefore` ou `sideEffects.dbAfter`.

## Limite explícito

A Fase 1.4 entrega o runner e prova execução com um caso bootstrap. A matriz completa de casos, variações por endpoint e capturas de side effects será expandida nos passos 1.5 a 1.18, conforme o plano.
