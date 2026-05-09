# SILO — Instruções para GitHub Copilot

Projeto **SILO** — sistema de gerenciamento de produtos industriais.
Stack: **Next.js 16 (App Router)**, React 19, Drizzle ORM + PostgreSQL, Kafka REST Proxy, TypeScript.
Estrutura: **Turborepo + npm workspaces** (monorepo).

---

## Estrutura

```
apps/
  web/        # Next.js — frontend + API Routes + Server Actions  (@silo/web)
  api/        # Express REST API — autenticação e recursos         (@silo/api)
  worker/     # Consumer Kafka (Node.js puro)                      (@silo/worker)
packages/
  db/         # Drizzle ORM — schema, migrations, conexão          (@silo/database)
  engine/     # Núcleo do sistema — config, domínio, contratos,    (@silo/engine)
              #   utilitários, kafka, dataflow, tipos, DTOs
  config/     # Configs compartilhadas — ESLint, TypeScript, Tailwind
scripts/      # Deploy e GitLab CI
docs/         # Documentação completa (leia docs/00-start.md primeiro)
```

---

## Comportamento do assistente

- **Sempre responda em português brasileiro**, independente do idioma da pergunta.
- Seja objetivo e direto. Evite introduções desnecessárias.
- Ao sugerir código, implemente — não apenas descreva.
- Ao encontrar um bug, corrija na raiz — não adicione workarounds.

---

## Regras fundamentais

1. **Apps dependem de pacotes. Pacotes nunca importam de apps.**
2. Todo import de banco usa `@silo/database`. Nunca paths relativos cross-package.
3. Todo import de utilitário, domínio, contrato ou tipo usa `@silo/engine/*`. Nunca paths relativos cross-package.
4. `@silo/engine` é o ponto de entrada único para: config, constants, date, validation, email, auth/hash, kafka, dataflow, domínio, contratos e tipos.
5. `@silo/database` expõe apenas `db`, `schema` e helpers de banco — sem lógica de negócio.
6. Arquivos de código seguem **kebab-case**. Componentes React seguem **PascalCase**.
7. Variáveis de ambiente vivem em `.env` na raiz. Validação via Zod no boot de cada app. Nunca `process.env` direto — use `@/lib/config`.
8. A versão exibida no web fica somente em `apps/web/src/lib/config.ts` como literal `appVersion`. Não usar env var, CI, `package.json` ou outra fonte para esse valor.

---

## Convenções de idioma e nomenclatura

- **Comentários de código em português** — explique o *porquê*, nunca o *o quê*.
- **Mensagens de commit em português** — siga o padrão Conventional Commits: `feat: adiciona validação de e-mail`, `fix: corrige timeout no worker`.
- **Identificadores em inglês** — variáveis, funções, classes, tipos, constantes e nomes de arquivo usam inglês.
- **Arquivos de código: kebab-case** — `product-status.ts`, `send-email-template.ts`.
- **Componentes React: PascalCase** — `ProductCard.tsx`, `UserAvatar.tsx`.
- **Rotas e diretórios Next.js: kebab-case** — `apps/web/app/admin/product-list/page.tsx`.

---

## Qualidade de código

- **Proibido `any`** — use tipos explícitos, `unknown` com narrowing, ou `z.infer<>` do Zod.
- **Sem type assertions desnecessários** — evite `as SomeType` quando o tipo pode ser inferido.
- **Código legível acima de tudo** — prefira clareza a esperteza. Nomes de variáveis e funções devem descrever a intenção, não a implementação.
- **Funções pequenas e com propósito único** — se uma função faz mais de uma coisa, divida.
- **Sem comentários óbvios** — comente apenas o *porquê*, nunca o *o quê*.
- **Sem código morto** — não deixe variáveis, imports ou funções não utilizadas.
- **Validação em funções e na borda do sistema** — valide dados externos com Zod; não valide internamente o que já foi tipado.
- **Erros explícitos** — nunca engula erros silenciosamente (`catch {}`); sempre logue ou relance.
- **Sem magic numbers** — extraia constantes nomeadas para valores literais com significado.

---

## Imports — regra rápida

```typescript
// Banco de dados → @silo/database
import { db } from "@silo/database";
import { authUser } from "@silo/database/schema";

// Tudo mais do monorepo → @silo/engine/*
import { config } from "@silo/engine/config";
import { formatDate } from "@silo/engine/date";
import { hashPassword } from "@silo/engine/auth/hash";
import { sendEmailTemplate } from "@silo/engine/email/send-email-template";
import { getProductStatus } from "@silo/engine/domain/product-status";
import type { CreateUserDto } from "@silo/engine/contracts/dto/users";
import { ApiResponse } from "@silo/engine/contracts/api-response";
import { produceRecordRest } from "@silo/engine/kafka/rest-client";

// Código interno ao apps/web → usa @/
import { config } from "@/lib/config";
import { getAuthUser } from "@/lib/auth/server";
```

---

## Comandos

```bash
npm install          # instala todas as dependências
npm run dev          # roda todos os apps em dev
npm run build        # build de todos os pacotes/apps
npm run db:migrate   # aplica migrations do banco
npm run dev -w @silo/worker  # roda apenas o worker
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