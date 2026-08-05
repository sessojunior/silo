# Arquitetura do Monorepo

Visao tecnica da estrutura de pacotes, fronteiras de responsabilidade e fluxo de dependencias.

---

## Visao geral

O repositório usa npm workspaces e esta em migracao para um backend Python canônico.

Fluxo principal atual:

```text
Browser -> apps/frontend (Next.js)
        -> apps/backend (FastAPI/Python)
        -> PostgreSQL
```

Componentes legados continuam presentes apenas como oraculos de migracao:

```text
apps/api    -> Express Node legado
apps/worker -> Worker Node legado
packages/db -> Drizzle legado
```

---

## Aplicacoes

### `apps/frontend`

- Frontend Next.js.
- Route handlers e Server Actions.
- Usa o backend Python como origem canonica de persistencia.

### `apps/backend`

- API FastAPI.
- Auth, uploads, reports, dashboard, chat, assistant, monitoring e worker Python.
- Fonte nova e canônica do sistema.

### `apps/api` e `apps/worker`

- Permanecem apenas para caracterizacao, comparacao e rollback durante a migracao.
- Nao devem receber features novas fora do plano.

---

## Pacotes compartilhados

### `@silo/engine`

- Contratos, tipos e utilitarios compartilhados entre frontend e legado TypeScript.

### `@silo/database`

- Drizzle legado durante a migracao.
- Permanece como referencia de contrato antigo e oraculo de comparacao.

### `packages/config`

- Configs compartilhadas de lint, TypeScript e Tailwind.

---

## Regras de dependencia

- `apps/frontend` nao acessa banco diretamente.
- `apps/backend` nao depende de `apps/frontend`.
- `apps/api` e `apps/worker` nao recebem dependencia nova do backend.
- `packages/*` nunca importam de `apps/*`.

---

## Backend Python

Estrutura principal:

```text
apps/backend/src/silo/
  api/
  auth/
  db/
  domain/
  integrations/
  realtime/
  worker/
```

Pontos importantes:

- `api/` concentra routers, middleware, schemas e handlers.
- `db/` concentra models, engine e base SQLAlchemy.
- `integrations/` concentra SMTP, Ollama, Kafka REST e uploads.
- `worker/` contem o consumer Python e seus handlers.

---

## Legado oracular

O legacy Node continua presente para:

- goldens e contrato comparativo;
- rollback durante a janela de migracao;
- verificacao de diferencas entre Node e Python.

Nao criar novo comportamento no legado se o mesmo fluxo ja existe no backend Python.

