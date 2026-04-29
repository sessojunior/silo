# SILO — Instruções para GitHub Copilot

Projeto **SILO** — sistema de gerenciamento de produtos industriais.
Stack: **Next.js 16 (App Router)**, React 19, Drizzle ORM + PostgreSQL, Kafka REST Proxy, TypeScript.
Estrutura: **Turborepo + npm workspaces** (monorepo).

---

## Estrutura

```
apps/
  web/        # Next.js — frontend + API Routes + Server Actions
  worker/     # Consumer Kafka (Node.js puro)
packages/
  database/   # Drizzle ORM — schema, migrations, conexão  (@silo/database)
  core/       # Utilitários compartilhados — datas, email, validação  (@silo/core)
  types/      # Tipagens TypeScript de domínio  (@silo/types)
  ui/         # Design System — componentes React puros  (@silo/ui)
  config/     # ESLint, TypeScript, Tailwind configs compartilhadas
scripts/      # Deploy e GitLab CI
docs/         # Documentação completa (leia docs/00-start.md primeiro)
```

---

## Regras fundamentais

1. **Apps dependem de pacotes. Pacotes nunca importam de apps.**
2. Todo import de banco usa `@silo/database`. Nunca paths relativos cross-package.
3. Todo import de utilitário usa `@silo/core/*`. Nunca paths relativos cross-package.
4. Arquivos de código seguem **kebab-case**. Componentes React seguem **PascalCase**.
5. Variáveis de ambiente vivem em `.env` na raiz. Validação via Zod no boot de cada app. Nunca `process.env` direto — use `@/lib/config`.

---

## Imports — regra rápida

```typescript
// Pacotes do monorepo → usa @silo/*
import { db } from "@silo/database";
import { authUser } from "@silo/database/schema";
import { formatDate } from "@silo/core/date";
import type { User } from "@silo/types";

// Código interno ao apps/web → usa @/
import { config } from "@/lib/config";
import { getAuthUser } from "@/lib/auth/token";
```

---

## Comandos

```bash
npm install          # instala todas as dependências
npm run dev          # roda todos os apps em dev
npm run build        # build de todos os pacotes/apps
npm run db:migrate   # aplica migrations do banco
npm run dev -w worker  # roda apenas o worker
```

---

## Documentação completa

Ver [docs/00-start.md](../docs/00-start.md) para a ordem de leitura recomendada e índice completo.

Docs relevantes por área:
- Padrões de código → [docs/03-patterns.md](../docs/03-patterns.md)
- Banco de dados → [docs/04-database.md](../docs/04-database.md)
- Autenticação → [docs/05-auth.md](../docs/05-auth.md)
- APIs REST → [docs/06-api.md](../docs/06-api.md)
- Kafka / worker → [docs/08-kafka.md](../docs/08-kafka.md)
- Deploy / Docker → [docs/12-docker.md](../docs/12-docker.md), [docs/13-deploy.md](../docs/13-deploy.md)
