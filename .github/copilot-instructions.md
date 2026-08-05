# SILO - Instrucoes para GitHub Copilot

Projeto **SILO** - sistema de gerenciamento de produtos industriais.
Stack atual: **Next.js 16 (App Router)**, React 19, FastAPI/Python, SQLAlchemy/Alembic, PostgreSQL, Kafka REST Proxy e TypeScript.
O backend canônico fica em `apps/backend/`. `apps/api/` e `apps/worker/` continuam apenas como oráculos legados durante a migração.

---

## Estrutura

```
apps/
  frontend/   # Next.js - frontend, route handlers e Server Actions  (@silo/web)
  backend/    # FastAPI/Python - API, IA, worker e migrations        (canônico)
  api/        # Express REST API legado usado como oracle
  worker/     # Consumer Kafka Node legado usado como oracle
packages/
  db/         # Drizzle ORM legado, mantido até o fim da migração
  engine/     # Contratos, tipos e utilitários compartilhados        (@silo/engine)
  config/     # Configs compartilhadas - ESLint, TypeScript, Tailwind
scripts/      # Deploy, load, segurança e CI
docs/         # Documentação completa (leia docs/00-start.md primeiro)
```

---

## Regras fundamentais

1. Apps dependem de pacotes. Pacotes nunca importam de apps.
2. O backend Python vive em `apps/backend` e é a implementação nova.
3. `apps/api` e `apps/worker` são legados e não devem receber features novas fora da migração.
4. Todo import compartilhado usa `@silo/engine/*`; nunca paths relativos cross-package.
5. O frontend não acessa banco diretamente. Persistência passa pelo backend.
6. Arquivos de codigo seguem kebab-case. Componentes React seguem PascalCase.
7. Variaveis de ambiente vivem em `.env` na raiz. Frontend valida via `apps/frontend/src/lib/config.ts`; backend valida via Pydantic no boot.
8. A versão exibida no web continua centralizada em `apps/frontend/src/lib/config.ts` como literal `appVersion`.

---

## Convenções

- Comentários de código em português.
- Mensagens de commit em português usando Conventional Commits.
- Identificadores em inglês.
- Rotas e diretórios do Next.js em kebab-case.

---

## Imports rápidos

```typescript
import { config } from "@silo/engine/config";
import { formatDate } from "@silo/engine/date";
import { getProductStatus } from "@silo/engine/domain/product-status";
import type { CreateUserDto } from "@silo/engine/contracts/dto/users";

import { config as webConfig } from "@/lib/config";
import { getAuthUser } from "@/lib/auth/server";
```

---

## Comandos úteis

```bash
# Frontend
cd apps/frontend && npm install && npm run dev

# Backend
uv --directory apps/backend sync --locked --all-groups
uv --directory apps/backend run --locked pytest -q
uv --directory apps/backend run --locked silo-openapi-export
```

---

## Documentação

- [docs/02-architecture.md](../docs/02-architecture.md)
- [docs/03-patterns.md](../docs/03-patterns.md)
- [docs/04-database.md](../docs/04-database.md)
- [docs/05-auth.md](../docs/05-auth.md)
- [docs/06-api.md](../docs/06-api.md)
- [docs/08-kafka.md](../docs/08-kafka.md)
- [docs/12-docker.md](../docs/12-docker.md)
- [docs/13-deploy.md](../docs/13-deploy.md)
