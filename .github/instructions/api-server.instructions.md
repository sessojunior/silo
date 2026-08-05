---
description: "Use when creating or modifying FastAPI route handlers, middleware, services, request validation, or API errors in apps/backend."
applyTo: "apps/backend/**/*.py"
---

# FastAPI API - apps/backend

Referencias:
- [docs/02-architecture.md](../../docs/02-architecture.md)
- [docs/06-api.md](../../docs/06-api.md)

## Estrutura

- `src/silo/api/main.py` monta app, routers e health checks.
- `src/silo/api/routers/*.py` deve ficar fino: autenticação, validação, chamada de service e resposta.
- `src/silo/api/middleware.py` concentra CORS, request id, trusted proxy, logs e limites.
- `src/silo/api/errors.py` centraliza exceções e mapeamento HTTP.
- `src/silo/api/dependencies.py` concentra sessão, permissões e guards reutilizáveis.

## Contrato HTTP

- Preserve método, path, status, headers observáveis e envelopes já caracterizados.
- Preserve camelCase nos DTOs públicos.
- Preserve diferença entre campo ausente e `null`.
- Mantenha `GET /health`, `GET /health/live` e `GET /health/ready` compatíveis com os testes.

## Validação e autenticação

- Valide payloads na borda com Pydantic.
- Use dependências compartilhadas para auth/permissões em vez de checks inline.
- Não duplique regra de autorização em múltiplos routers quando um guard central resolver.

## Dados e config

- Use os serviços e repositórios do backend Python; não espalhe acesso direto ao DB pelos routers.
- Não leia `os.environ` fora do bootstrap e do módulo de settings.
- Qualquer integração externa deve passar por adapter explícito.

## Erros e logs

- Nunca exponha stack trace, query, prompt, tool args ou segredo para o cliente.
- Logs devem ser sanitizados e conter contexto mínimo suficiente para depuração.

## Regra prática

- Router bom é fino, previsível e sem regra de negócio pesada.
