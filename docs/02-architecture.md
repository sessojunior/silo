# Arquitetura do Monorepo

Visão técnica da estrutura de pacotes, fronteiras de responsabilidade e fluxo de dependências.

---

## Visão geral

O projeto usa **Turborepo** para orquestração e **npm workspaces** para gerenciamento de dependências.

```
apps/web          ──┐
apps/worker       ──┤──► packages/database
                    ├──► packages/core
                    ├──► packages/types
apps/web          ──┘──► packages/ui
```

**Regra de ouro:** pacotes nunca importam de apps. O grafo de dependência é sempre unidirecional: apps → packages.

---

## Pacotes (`packages/`)

### `@silo/database`
- **Caminho:** `packages/database/`
- **Responsabilidade:** Fonte única de verdade do banco. Schema Drizzle, conexão PostgreSQL, migrations, seed.
- **Exports:**
  - `@silo/database` → `src/index.ts` (instância `db` e helpers)
  - `@silo/database/schema` → `src/schema/index.ts` (todas as tabelas)
- **Scripts:** `db:generate`, `db:push`, `db:migrate`, `db:seed`, `db:studio`
- **Variáveis:** `DATABASE_URL_DEV` / `DATABASE_URL_PROD`

### `@silo/core`
- **Caminho:** `packages/core/`
- **Responsabilidade:** Utilitários compartilhados sem dependência de React ou Next.js.
- **Exports:**
  - `@silo/core/date` → manipulação de datas (`date-fns`, `date-fns-tz`)
  - `@silo/core/date-config` → configuração de locale e timezone
  - `@silo/core/email` → templates de e-mail
  - `@silo/core/send-email` → wrapper Nodemailer
  - `@silo/core/utils` → utilitários genéricos
  - `@silo/core/validation` → schemas Zod reutilizáveis
  - `@silo/core/markdown` → parsing Markdown
  - `@silo/core/constants` → constantes de domínio
  - `@silo/core/product-status` → lógica de status de produtos
  - `@silo/core/product-activity` → histórico de atividade de produtos
  - `@silo/core/task-history` → histórico de tarefas
  - `@silo/core/api-response` → helpers de resposta de API

### `@silo/types`
- **Caminho:** `packages/types/`
- **Responsabilidade:** Interfaces e tipos TypeScript de domínio que não dependem do banco.
- **Export:** `@silo/types` → `src/index.ts`
- **Conteúdo:** Enums de domínio, tipos de eventos Kafka, DTOs genéricos.

### `@silo/ui`
- **Caminho:** `packages/ui/`
- **Responsabilidade:** Design System. Apenas componentes burros (sem fetch, sem banco).
- **Exports:**
  - `@silo/ui/components/*` → componentes React
  - `@silo/ui/hooks/*` → hooks de UI puros
  - `@silo/ui/styles.css` → CSS global
- **Peer dependencies:** `react`, `react-dom`

### `@silo/typescript-config`
- **Caminho:** `packages/config/typescript-config/`
- **Arquivos:** `base.json`, `nextjs.json`, `react-library.json`

### `@silo/eslint-config`
- **Caminho:** `packages/config/eslint-config/`
- **Arquivos:** `library.js`, `next.js`

### `@silo/tailwind-config`
- **Caminho:** `packages/config/tailwind-config/`

---

## Aplicações (`apps/`)

### `apps/web` — Next.js App Router
- **Responsabilidade:** Frontend, API Routes, Server Actions, autenticação.
- **Dependências internas:** `@silo/database`, `@silo/core`, `@silo/types`, `@silo/ui`
- **Libs específicas (não extraídas para packages):**
  - `src/lib/auth/` — configuração Better Auth (acoplada ao Next.js)
  - `src/lib/config.ts` — variáveis de ambiente do web
  - `src/lib/kafka-rest.ts` — cliente REST Proxy para publicação de eventos
  - `src/lib/local-uploads.ts` — gerenciamento de uploads no servidor
  - `src/lib/rate-limit.ts` — rate limiting nas API Routes
  - `src/lib/dataflow/` — lógica do módulo de fluxo de dados
  - `src/lib/navigation/` — helpers de navegação Next.js
  - `src/lib/permissions/` — autorização vinculada à sessão
- **Scripts:** `dev`, `build`, `start`, `lint`
- **Config principal:** `apps/web/next.config.ts`

### `apps/worker` — Consumer Kafka
- **Responsabilidade:** Consumo de tópicos Kafka via REST Proxy, persistência no banco.
- **Dependências internas:** `@silo/database`, `@silo/core`
- **Entry point:** `src/index.ts`
- **Scripts:** `dev` (tsx watch), `build` (tsc), `start` (node dist/index.js)
- **Não tem React. Não tem Next.js.**

---

## Configuração Next.js para monorepo

O Next.js não transpila pacotes externos por padrão. Em `apps/web/next.config.ts`:

```typescript
const nextConfig = {
  transpilePackages: ["@silo/ui", "@silo/core", "@silo/database"],
};
```

O Tailwind em `apps/web` deve incluir o diretório do `@silo/ui` no `content`:

```typescript
content: [
  "./src/**/*.{js,ts,jsx,tsx,mdx}",
  "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
],
```

---

## Variáveis de ambiente

Um único `.env` na raiz do monorepo. Cada app lê as variáveis que precisa. A validação via Zod ocorre no boot de cada app, nunca dentro de packages.

Ver `env.example` na raiz para todas as variáveis disponíveis.

---

## Turbo tasks

Declaradas em `turbo.json`. O Turborepo garante que `packages/database` seja buildado antes de `apps/web` e `apps/worker`.

```
build  → dependsOn: ["^build"]  → outputs: [".next/**", "dist/**"]
dev    → cache: false, persistent: true
lint   → dependsOn: ["^lint"]
```

---

## Instalar dependências em um workspace específico

```bash
# Instalar pacote npm na web
npm install <pacote> -w web

# Instalar pacote npm no worker
npm install <pacote> -w worker

# Instalar pacote npm no @silo/ui
npm install <pacote> -w @silo/ui
```
