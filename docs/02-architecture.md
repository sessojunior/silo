# Arquitetura do Monorepo

Visão técnica da estrutura de pacotes, fronteiras de responsabilidade e fluxo de dependências.

---

## Visão geral

O projeto usa **Turborepo** para orquestração e **npm workspaces** para gerenciamento de dependências.

```
apps/web          ──┐
apps/api          ──┤──► packages/db      (@silo/database)
apps/worker       ──┘──► packages/engine  (@silo/engine)

Fluxo de dados principal:
web -> api -> db
     ↓
   engine
     ↓
   worker
```

**Regra de ouro:** pacotes nunca importam de apps. O grafo de dependência é sempre unidirecional: apps → packages.

---

## Pacotes (`packages/`)

### `@silo/database`
- **Caminho:** `packages/db/`
- **Responsabilidade:** Fonte única de verdade do banco. Schema Drizzle, conexão PostgreSQL, migrations, seed.
- **Exports:**
  - `@silo/database` → `src/index.ts` (instância `db` e helpers)
  - `@silo/database/schema` → `src/schema/index.ts` (todas as tabelas)
- **Scripts:** `db:generate`, `db:push`, `db:migrate`, `db:seed`, `db:studio`
- **Variáveis:** `DATABASE_URL_DEV` / `DATABASE_URL_PROD`

### `@silo/engine`
- **Caminho:** `packages/engine/`
- **Responsabilidade:** Núcleo único do sistema. Contém toda a lógica compartilhada que não é banco.
- **Exports (subpaths):**
  - `@silo/engine/config` → configuração global (env vars via Zod)
  - `@silo/engine/constants` → constantes de domínio
  - `@silo/engine/date` → manipulação de datas (`date-fns`, `date-fns-tz`)
  - `@silo/engine/validation` → schemas Zod reutilizáveis
  - `@silo/engine/auth/hash` → hash e verificação de senha
  - `@silo/engine/email/send-email-template` → envio de e-mails
  - `@silo/engine/kafka/rest-client` → cliente Kafka REST Proxy
  - `@silo/engine/dataflow/types` → tipos do módulo DataFlow
  - `@silo/engine/dataflow/helpers` → helpers de normalização DataFlow
  - `@silo/engine/domain/product-status` → lógica de status de produtos
  - `@silo/engine/domain/scheduling` → tipos, disponibilidade e detecção de conflitos por turno
  - `@silo/engine/contracts/api-response` → helper de resposta de API
  - `@silo/engine/contracts/kafka-events` → eventos Kafka
  - `@silo/engine/contracts/dto/*` → DTOs de request/response por recurso

  ### Quando usar cada contrato

  - `@silo/database/schema` é para persistência e consultas Drizzle; não é contrato HTTP.
  - `@silo/engine/validation` é para validar a borda com Zod antes de chamar services ou banco.
  - `@silo/engine/contracts/dto/*` é para payloads que cruzam fronteiras entre app, service e API.
  - `@silo/engine/contracts/api-response` é para o envelope compartilhado das respostas HTTP.
  - Regra prática: schema descreve banco, DTO descreve transporte e contrato descreve interoperabilidade.

O nome técnico atual do submódulo continua sendo `scheduling`, mas a linguagem pública do domínio deve falar em turnos de execução, disponibilidade, bloqueios, exceções e conflitos.

### `@silo/typescript-config`
- **Caminho:** `packages/config/typescript-config/`
- **Arquivos:** `base.json`, `nextjs.json`, `react-library.json`

### `@silo/eslint-config`
- **Caminho:** `packages/config/eslint-config/`
- **Arquivos:** `library.mjs`, `next.mjs`

### `@silo/tailwind-config`
- **Caminho:** `packages/config/tailwind-config/`

---

## Aplicações (`apps/`)

### `apps/web` — Next.js App Router
- **Responsabilidade:** Frontend, API Routes, Server Actions, autenticação.
- **Dependências internas:** `@silo/engine`
- **Regra:** não acessa banco diretamente; usa API (`apps/api`) para persistência.
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

### `apps/api` — Express REST API
- **Responsabilidade:** Endpoints REST de autenticação e recursos
- **Dependências internas:** `@silo/database`, `@silo/engine`
- **Entry point:** `src/index.ts`
- **Não tem React. Não tem Next.js.**

### `apps/worker` — Consumer Kafka
- **Responsabilidade:** Consumo de tópicos Kafka via REST Proxy, persistência no banco.
- **Dependências internas:** `@silo/database`, `@silo/engine`
- **Entry point:** `src/index.ts`
- **Scripts:** `dev` (tsx watch), `build` (tsc), `start` (node dist/index.js)
- **Não tem React. Não tem Next.js.**

---

## Configuração Next.js para monorepo

O Next.js não transpila pacotes externos por padrão. Em `apps/web/next.config.ts`:

```typescript
const nextConfig = {
  transpilePackages: ["@silo/engine"],
};

```

---

## Variáveis de ambiente

Um único `.env` na raiz do monorepo. Cada app lê as variáveis que precisa. A validação via Zod ocorre no boot de cada app, nunca dentro de packages.

Ver `env.example` na raiz para todas as variáveis disponíveis.

---

## Turbo tasks

Declaradas em `turbo.json`. O Turborepo garante que `packages/db` seja buildado antes dos apps dependentes.

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

# Instalar pacote npm no @silo/engine
npm install <pacote> -w @silo/engine
```
