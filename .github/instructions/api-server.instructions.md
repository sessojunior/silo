---
description: "Use when creating or modifying Express route handlers, middleware, services, request validation, or API errors in apps/api."
applyTo: "apps/api/**/*.ts"
---

# Express API — apps/api

Referências:
- [docs/02-architecture.md](../../docs/02-architecture.md)
- [docs/06-api.md](../../docs/06-api.md)

## Estrutura

- `src/index.ts` monta middlewares globais, rotas e health checks.
- `src/routes/*.ts` deve ficar fino: autenticação, validação, chamada de service e resposta.
- `src/services/*.ts` concentra regra de negócio e integração com o banco.
- `src/middleware/*.ts` concentra auth, permissões, rate limit e regras transversais.

## Contrato HTTP

- Sucesso: `success: true` com `data` e, quando fizer sentido, `message`.
- Erro: `success: false` com `error` e, opcionalmente, `field`.
- Use status corretos: `200`, `201`, `400`, `401`, `403`, `404`, `429` e `500`.

## Validação e autenticação

- Valide `req.body`, `req.query` e `req.params` com Zod antes de chamar serviços.
- Use `authMiddleware` e `requirePermission` em vez de checks inline.
- Não repita regra de admin ou grupo em rota; centralize em middleware ou service.

## Dados e config

- Use `@silo/database` para persistência e `@silo/engine/*` para contratos, config e validação compartilhada.
- Nunca importe de `apps/web` nem use paths relativos entre pacotes.
- Nunca espalhe `process.env`; use `@silo/engine/config` e o bootstrap local do app.

## Erros e logs

- Sempre envolva handlers em `try/catch`.
- Logue com contexto suficiente para diagnóstico.
- Não exponha stack trace, query ou detalhe interno para o cliente.

## Regra prática

- Route handler bom é fino, previsível e sem regra de negócio pesada.