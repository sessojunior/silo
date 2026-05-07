---
description: "Use when creating new packages, configuring workspaces, setting up shared configs, or working with the Turborepo monorepo structure. Covers npm workspaces, @silo/* packages, and cross-package dependency rules."
---

# Monorepo SILO — Turborepo + npm workspaces

Referência: [docs/02-architecture.md](../../docs/02-architecture.md)

---

## Estrutura de pacotes

```
apps/
  web/      # Next.js (App Router) — @silo/web
  api/      # Express REST API — @silo/api
  worker/   # Kafka consumer (Node.js puro) — @silo/worker
packages/
  db/               # @silo/database  (Drizzle ORM — schema, migrations, conexão)
  engine/           # @silo/engine    (núcleo: config, domínio, contratos, utilitários,
                    #                  kafka, dataflow, tipos, DTOs, email, validação)
  config/
    eslint-config/      # @silo/eslint-config
    typescript-config/  # @silo/typescript-config
    tailwind-config/    # @silo/tailwind-config
```

---

## Regra de dependências

```
apps/web     → pode importar de @silo/engine (sem acesso direto ao banco)
apps/api     → pode importar de @silo/database e @silo/engine
apps/worker  → pode importar de @silo/database e @silo/engine
packages/*   → NUNCA importa de apps/*
@silo/engine → não importa de @silo/database (core de regra/contrato)
@silo/database → não importa de nenhum @silo/* (apenas dependências npm)
```

---

## Imports corretos

```typescript
// Banco de dados → @silo/database
import { db } from "@silo/database";
import { authUser } from "@silo/database/schema";

// Tudo mais → @silo/engine/* (config, domínio, contratos, kafka, dataflow, tipos…)
import { config } from "@silo/engine/config";
import { formatDate } from "@silo/engine/date";
import { sendEmailTemplate } from "@silo/engine/email/send-email-template";
import { hashPassword } from "@silo/engine/auth/hash";
import { getProductStatus } from "@silo/engine/domain/product-status";
import type { CreateUserDto } from "@silo/engine/contracts/dto/users";
import { ApiResponse } from "@silo/engine/contracts/api-response";
import { produceRecordRest } from "@silo/engine/kafka/rest-client";

// Dentro de apps/web → alias interno
import { config } from "@/lib/config";
import { getAuthUser } from "@/lib/auth/server";

// ❌ NUNCA — paths relativos cross-package
import { db } from "../../packages/db/src";
// ❌ NUNCA — imports dos pacotes legados removidos
import { formatDate } from "@silo/legacy/date";
import type { User } from "@silo/legacy-types";
import { getProductStatus } from "@silo/legacy-domain";
```

---

## package.json de um pacote novo

```json
{
  "name": "@silo/meu-pacote",
  "version": "0.1.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./utils": "./src/utils.ts"
  },
  "devDependencies": {
    "@silo/typescript-config": "*",
    "typescript": "^5.9.3"
  }
}
```

---

## Variáveis de ambiente

- Arquivo único: `.env` na raiz do monorepo.
- **Nunca** `process.env.SOMETHING` direto dentro de um pacote.
- Validação via Zod no boot de cada app (`apps/web/src/lib/config.ts`, `apps/api/src/lib/config.ts`, `apps/worker/src/lib/config.ts`).
- Pacotes recebem config como parâmetros de função — não leem env diretamente.

---

## Turborepo — tasks

`turbo.json` define o pipeline. Tasks importantes:

| Task | Descrição |
|---|---|
| `build` | Compila todos os pacotes em ordem de dependência |
| `dev` | Hot-reload em todos os apps |
| `lint` | Lint de todos os pacotes |
| `db:generate` | Gera migrations do Drizzle |
| `db:migrate` | Aplica migrations do Drizzle |
| `db:push` | Push do schema sem migrations |
| `db:studio` | Abre o Drizzle Studio |

---

## Comandos filtrados

```bash
npm run dev -w @silo/worker           # roda apenas o worker
turbo run build --filter=@silo/web    # build apenas do web
turbo run dev --filter=@silo/api      # dev apenas da api
```


---

## Convenções de nomenclatura e idioma

| Elemento | Padrão | Exemplo |
|---|---|---|
| Arquivos de código | kebab-case | `product-status.ts`, `send-email-template.ts` |
| Componentes React | PascalCase | `ProductCard.tsx`, `UserAvatar.tsx` |
| Diretórios de rota (Next.js) | kebab-case | `app/admin/product-list/page.tsx` |
| Variáveis e funções | inglês | `const productList`, `function getUserById` |
| Tipos e interfaces | inglês | `type ProductStatus`, `interface AuthUser` |
| Constantes | inglês, UPPER_SNAKE_CASE | `const MAX_RETRY_ATTEMPTS = 3` |
| Comentários de código | português | `// Ignora registros deletados logicamente` |
| Mensagens de commit | português (Conventional Commits) | `feat: adiciona paginação na listagem de produtos` |
