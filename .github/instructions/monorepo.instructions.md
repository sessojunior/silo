---
description: "Use when creating new packages, configuring workspaces, setting up shared configs, or working with the Turborepo monorepo structure. Covers npm workspaces, @silo/* packages, and cross-package dependency rules."
---

# Monorepo SILO — Turborepo + npm workspaces

Referência: [docs/02-architecture.md](../../docs/02-architecture.md)

---

## Estrutura de pacotes

```
apps/
  web/      # Next.js (App Router) — @/
  worker/   # Kafka consumer (Node.js puro)
packages/
  database/         # @silo/database
  core/             # @silo/core
  types/            # @silo/types
  ui/               # @silo/ui
  config/
    eslint-config/      # @silo/eslint-config
    typescript-config/  # @silo/typescript-config
    tailwind-config/    # @silo/tailwind-config
```

---

## Regra de dependências

```
apps/web     → pode importar de qualquer @silo/*
apps/worker  → pode importar de @silo/database, @silo/core, @silo/types
packages/*   → NUNCA importa de apps/*
packages/*   → pode importar de outros packages/* (sem circular)
```

---

## Imports corretos

```typescript
// De apps/web ou apps/worker → pacotes do monorepo
import { db } from "@silo/database";
import { authUser } from "@silo/database/schema";
import { formatDate } from "@silo/core/date";
import { sendEmail } from "@silo/core/send-email";
import type { User } from "@silo/types";
import { Button } from "@silo/ui/components/Button";

// Dentro de apps/web → alias interno
import { config } from "@/lib/config";
import { getAuthUser } from "@/lib/auth/token";

// ❌ NUNCA — paths relativos cross-package
import { db } from "../../packages/database/src";
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
- Validação via Zod no boot de cada app (`apps/web/src/lib/config.ts`, `apps/worker/src/config.ts`).
- Pacotes recebem config como parâmetros de função — não leem env diretamente.

---

## Turborepo — tasks

`turbo.json` define o pipeline. Tasks importantes:

| Task | Descrição |
|---|---|
| `build` | Compila todos os pacotes em ordem de dependência |
| `dev` | Hot-reload em todos os apps |
| `lint` | Lint de todos os pacotes |
| `db:migrate` | Aplica migrations do Drizzle |

---

## Convenções de arquivo

- Arquivos de código: **kebab-case** (`my-file.ts`, `product-status.ts`)
- Componentes React: **PascalCase** (`ProductCard.tsx`, `UserAvatar.tsx`)
- Diretórios de rota Next.js: **kebab-case** (`/admin/product-list/page.tsx`)
