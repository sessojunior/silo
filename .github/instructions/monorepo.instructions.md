---
description: "Use when working with workspace layout, shared configs, package boundaries, or cross-app dependencies in the SILO monorepo."
---

# Monorepo SILO - npm workspaces

Referência: [docs/02-architecture.md](../../docs/02-architecture.md)

---

## Estrutura canônica

```
apps/
  frontend/   # Next.js web
  backend/    # FastAPI/Python canônico
  api/        # Express legado, apenas oráculo de migração
  worker/     # Worker Node legado, apenas oráculo de migração
packages/
  db/         # Drizzle legado
  engine/     # Contratos, tipos e utilitários compartilhados
  config/     # Configs compartilhadas
```

---

## Regra de dependências

```
apps/frontend  -> pode importar de @silo/engine
apps/backend   -> backend Python canônico
apps/api       -> legado/oráculo
apps/worker    -> legado/oráculo
packages/*     -> nunca importa de apps/*
```

---

## Imports corretos

```typescript
import { config } from "@silo/engine/config";
import type { CreateUserDto } from "@silo/engine/contracts/dto/users";
import { getAuthUser } from "@/lib/auth/server";
```

---

## Ambiente

- Arquivo único: `.env` na raiz.
- Frontend valida via `apps/frontend/src/lib/config.ts`.
- Backend Python valida via `apps/backend/src/silo/config.py`.
- Evite `process.env` espalhado fora do bootstrap.

---

## Scripts principais

| Script | Descrição |
|---|---|
| `dev:web` | Inicia o frontend |
| `dev:api` | Inicia o legado Node de API |
| `dev:worker` | Inicia o legado Node do worker |
| `py:sync` | Sincroniza o backend Python |
| `py:test` | Executa testes Python |
| `py:openapi` | Exporta OpenAPI do backend |
| `build` | Compila os workspaces JS |

