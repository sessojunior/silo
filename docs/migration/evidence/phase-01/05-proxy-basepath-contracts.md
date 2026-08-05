# Fase 1.5 — contratos de proxy `/api/*` e `/api/admin/*`

Data: 2026-07-21  
Status: concluído.

## Casos criados

- `tests/contracts/legacy/cases.proxy-silo.json`
- `tests/contracts/legacy/cases.proxy-empty-base.json`

## Goldens capturados

- `tests/fixtures/legacy-golden/api.warmup.direct.json`
- `tests/fixtures/legacy-golden/web.proxy.silo.api-admin.warmup.json`
- `tests/fixtures/legacy-golden/web.proxy.empty-base.api-admin.warmup.json`

## Cobertura da etapa

1. Chamada direta `POST /api/warmup` contra `api-node:4000`.
2. Chamada pública `POST /silo/api/admin/warmup` via Next com `NEXT_PUBLIC_BASE_PATH=/silo`.
3. Chamada pública `POST /api/admin/warmup` via Next com base pública efetiva vazia.

## Observação sobre base vazia

No código atual do web, `config.publicBasePath` usa:

```ts
const raw = (process.env.NEXT_PUBLIC_BASE_PATH || "/silo").trim();
if (raw.length === 0 || raw === "/") return "";
```

Portanto, `NEXT_PUBLIC_BASE_PATH=""` cai no default `/silo`. Para testar base efetivamente vazia sem alterar código, a execução usou `NEXT_PUBLIC_BASE_PATH="/"`, que a própria config normaliza para `""`.

## Evidências de execução

- `docs/migration/evidence/phase-01/05-runner-proxy-silo.stdout.log`
- `docs/migration/evidence/phase-01/05-runner-proxy-silo.stderr.log`
- `docs/migration/evidence/phase-01/05-runner-proxy-empty-base.stdout.log`
- `docs/migration/evidence/phase-01/05-runner-proxy-empty-base.stderr.log`
- `docs/migration/evidence/phase-01/05-web-silo.stdout.log`
- `docs/migration/evidence/phase-01/05-web-silo.stderr.log`
- `docs/migration/evidence/phase-01/05-web-empty-base.stdout.log`
- `docs/migration/evidence/phase-01/05-web-empty-base.stderr.log`
- `docs/migration/evidence/phase-01/05-api-node.stdout.log`
- `docs/migration/evidence/phase-01/05-api-node.stderr.log`
- `docs/migration/evidence/phase-01/05-external-stub.stdout.log`
- `docs/migration/evidence/phase-01/05-external-stub.stderr.log`

## Desvio corrigido durante execução

A primeira tentativa do Next com `/silo` foi iniciada a partir da raiz com `next dev apps/web`, o que fez o `next.config.ts` resolver `./src/lib/config` contra o diretório errado. A execução aprovada iniciou o Next com cwd `apps/web`, equivalente ao workspace.
