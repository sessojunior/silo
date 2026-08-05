---
description: "Use when creating or modifying Next.js route handlers under apps/frontend/src/app/api."
applyTo: "apps/frontend/src/app/api/**/*.ts"
---

# API Patterns - apps/frontend

Referências:
- [docs/02-architecture.md](../../docs/02-architecture.md)
- [docs/06-api.md](../../docs/06-api.md)
- [docs/12-docker.md](../../docs/12-docker.md)

## Regra geral

- `apps/frontend/src/app/api/admin/*` faz proxy de same-origin para o backend Python.
- `apps/frontend/src/app/api/auth/*` e outras rotas locais só tratam lógica do web.
- Nunca acesse banco diretamente do frontend.

## Proxy para o backend

- Reescreva chamadas administrativas para `API_URL`.
- Preserve `NEXT_PUBLIC_BASE_PATH`.
- Não espalhe URL do backend pelo app; use helper centralizado.

## Segurança

- Valide origem e cookies sempre que a rota mutar estado.
- Não exponha segredo, token ou payload interno em respostas ou logs.

