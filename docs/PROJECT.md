# Projeto SILO

Resumo tecnico do repositorio e do estado atual da migracao.

---

## Estado atual

O repositorio esta consolidado em um backend Python canonico.

- Frontend: `apps/frontend`
- Backend novo: `apps/backend`
- Workspaces npm ativos: `apps/frontend`, `packages/config`, `packages/engine`
- Legado Node/Drizzle: removido do tree de trabalho e mantido apenas nas evidencias historicas da migracao

---

## Fluxo principal

```text
Browser -> Next.js (apps/frontend) -> FastAPI (apps/backend) -> PostgreSQL
```

O frontend continua responsavel por navegacao, upload routes, auth UI e pagina admin.
O backend Python concentra API, auth, dashboard, reports, monitoring, chat, assistant e worker.

---

## Pacotes compartilhados

- `packages/engine` - contratos, tipos e utilitarios compartilhados.
- `packages/config` - configs compartilhadas do monorepo.

---

## Principios

- Frontend nao acessa banco diretamente.
- `apps/backend` e a fonte canonica de persistencia.
- A documentacao de migracao preserva o contexto historico do Node legado sem manter o tree antigo na superficie ativa.
- Documentacao, CI, Docker e scripts devem refletir o backend Python.
