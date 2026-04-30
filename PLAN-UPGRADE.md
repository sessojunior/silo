# Plano de Upgrade: Monorepo com 3 Runtimes Isolados (Silo)

> Este documento substitui `PLAN-MONOREPO.md` e `PLAN-REFACTOR.md`. Parte do estado atual — uma aplicação **Next.js monolítica** — e define o caminho completo até a arquitetura final: um monorepo com três runtimes independentes (`web`, `api`, `worker`) conectados por contratos tipados.

---

## Sumário

1. [Diagnóstico do Estado Atual](#1-diagnóstico-do-estado-atual)
2. [Arquitetura Alvo](#2-arquitetura-alvo)
3. [Estrutura de Diretórios Alvo](#3-estrutura-de-diretórios-alvo)
4. [Os Três Runtimes](#4-os-três-runtimes)
5. [Os Pacotes Compartilhados](#5-os-pacotes-compartilhados)
6. [O Pacote `@silo/contracts`](#6-o-pacote-silocontracts)
7. [Configurações de Tooling](#7-configurações-de-tooling)
8. [Fluxo de Dados e Comunicação](#8-fluxo-de-dados-e-comunicação)
9. [Banco de Dados Centralizado](#9-banco-de-dados-centralizado)
10. [Autenticação no Novo Modelo](#10-autenticação-no-novo-modelo)
11. [Upload de Arquivos](#11-upload-de-arquivos)
12. [Kafka e o Worker](#12-kafka-e-o-worker)
13. [Configuração do Turborepo e npm Workspaces](#13-configuração-do-turborepo-e-npm-workspaces)
14. [Dockerização dos Runtimes](#14-dockerização-dos-runtimes)
15. [Variáveis de Ambiente](#15-variáveis-de-ambiente)
16. [Pipeline de CI/CD](#16-pipeline-de-cicd)
17. [Fases de Migração](#17-fases-de-migração)
18. [Checklist de Migração por Domínio](#18-checklist-de-migração-por-domínio)
19. [Convenções e Regras de Fronteira](#19-convenções-e-regras-de-fronteira)
20. [Boas Práticas e Armadilhas do Next.js em Monorepo](#20-boas-práticas-e-armadilhas-do-nextjs-em-monorepo)
21. [Riscos e Mitigações](#21-riscos-e-mitigações)
22. [Diagrama de Dependências](#22-diagrama-de-dependências)

---

## 1. Diagnóstico do Estado Atual

### 1.1 O que existe hoje

O projeto é uma aplicação **Next.js monolítica** onde tudo coexiste no mesmo diretório:

**Rotas de negócio dentro do Next.js (`src/app/api/`):**
- `api/admin/chat/` — mensagens e canais de chat
- `api/admin/contacts/` — CRUD de contatos
- `api/admin/dashboard/` — dados agregados do painel
- `api/admin/groups/` — grupos e permissões
- `api/admin/help/` — artigos de ajuda
- `api/admin/incidents/` — CRUD de incidentes
- `api/admin/monitoring/` — monitoramento de sistemas
- `api/admin/products/` — CRUD de produtos com sub-rotas: activities, contacts, dependencies, images, manual, problems, solutions
- `api/admin/projects/` — CRUD de projetos com imagens e detalhes
- `api/admin/reports/` — relatórios gerenciais
- `api/admin/tasks/` — CRUD de tarefas
- `api/admin/users/` — gerenciamento de usuários
- `api/auth/[...all]/` — handler do `better-auth` (login, logout, OAuth, OTP)
- `api/upload/` — upload de arquivos

**Infraestrutura de backend misturada ao frontend (`src/lib/`):**
- `lib/auth/server.ts` — instância do `better-auth` com adapter Drizzle, plugins OTP, middleware de auth
- `lib/auth/client.ts` — SDK cliente do `better-auth`
- `lib/auth/hash.ts`, `lib/auth/urls.ts`, `lib/auth/validate.ts`, `lib/auth/user-groups.ts` — helpers de auth
- `lib/permissions/index.ts` — RBAC: verifica grupos e permissões consultando o banco
- `lib/localUploads.ts` — armazenamento local de arquivos
- `lib/profileImage.ts` — processamento de imagem de perfil
- `lib/rateLimit.ts` — rate limiting nas API Routes
- `lib/dataflow/kafkaDataFlowSource.ts` — consumo de dados Kafka para o frontend

**Lógica de domínio sem isolamento (`src/lib/` ou pacotes compartilhados):**
- `@silo/core` exporta: `api-response`, `auth/hash`, `auth/urls`, `kafkaRest`, `product-status`, `product-activity-history`, `product-activity-pending-email`, `task-history` — **lógica puramente de backend misturada a utilitários neutros**
- `@silo/database` — schemas Drizzle importados diretamente pelo Next.js e pelo worker

**Consumer Kafka (`apps/worker`):**
- Usa Kafka REST Proxy (via `@silo/core/kafka-rest`) ao invés de KafkaJS diretamente
- Importa `@silo/database` e `@silo/core` diretamente

### 1.2 Problemas concretos

| Problema | Impacto |
|---|---|
| Next.js conecta direto ao banco | Pooling de conexões incontrolável; escalar o frontend escala as queries junto |
| `better-auth` server no processo Next.js | Segredos de sessão (`BETTER_AUTH_SECRET`) expostos ao mesmo processo que serve HTML |
| API Routes sem middleware centralizado | Rate limiting, auth e validação replicados em cada `route.ts`; inconsistências garantidas |
| Worker e Web dependem de `@silo/core` com lógica de backend | Mudança em `auth/hash.ts` pode quebrar o worker sem relação com Kafka |
| `@silo/core` mistura domínio com utilitários | `product-status.ts`, `task-history.ts` e `kafkaRest.ts` no mesmo pacote que `date-utils.ts` |
| Sem contrato formal entre cliente e servidor | `fetch()` retorna `any`; nenhum garantia TypeScript entre request e response |
| Deploy do frontend exige rebuild das API Routes | Rollback isolado da UI é impossível |
| `DATABASE_URL` no ambiente do processo Next.js | Qualquer XSS no frontend pode exfiltrar credenciais do banco |
| `kafkaRest.ts` exportado de `@silo/core` | O cliente Kafka é importável acidentalmente pelo frontend |

### 1.3 Por que 3 runtimes resolvem

- **`web`** só renderiza. Não sabe SQL, não tem `DATABASE_URL`, não tem segredos de auth.
- **`api`** é o único ponto de acesso ao banco. Middleware centralizado, validação, RBAC.
- **`worker`** processa eventos assíncronos. Nunca expõe HTTP externamente.

O código compartilhado entre os três são **contratos** (tipos de request/response/evento) e **utilitários neutros** (formatação de data, constantes, validações genéricas).

---

## 2. Arquitetura Alvo

```
┌──────────────────────────────────────────────────────────┐
│                      BROWSER / CLIENT                    │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTPS
                             ▼
┌──────────────────────────────────────────────────────────┐
│                       apps/web                           │
│                    Next.js (UI only)                     │
│   Server Components, Client Components                   │
│   Exceções: /api/auth (callback), /api/revalidate        │
│   Toda busca de dados: fetch() → apps/api                │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTP (REST)
                             ▼
┌──────────────────────────────────────────────────────────┐
│                       apps/api                           │
│               Node.js + Express (Backend)                │
│   Middleware: auth, rate limit, validação, RBAC          │
│   Routes: todos os endpoints de negócio                  │
│   Services: lógica de domínio pura e testável            │
│   Producer: publica eventos no Kafka                     │
└──────────────┬─────────────────────────┬─────────────────┘
               │ SQL (Drizzle)           │ Kafka (Producer)
               ▼                         ▼
┌──────────────────────┐      ┌──────────────────────────────┐
│     PostgreSQL       │      │           Kafka              │
│   (centralizado)     │      │    (tópicos de domínio)      │
└──────────────────────┘      └─────────────────┬────────────┘
               ▲                                │ Kafka (Consumer)
               │ SQL (Drizzle)                  ▼
               │                    ┌───────────────────────┐
               └────────────────────│      apps/worker      │
                                    │   Node.js (Background)│
                                    │   Email, status sync  │
                                    └───────────────────────┘
```

**Regra de ouro:** Apenas `apps/api` e `apps/worker` acessam o banco. `apps/web` **nunca** importa `@silo/db`.

---

## 3. Estrutura de Diretórios Alvo

```text
silo-sessojunior/
│
├── apps/
│   ├── web/                          # Runtime 1: Next.js (UI pura)
│   │   ├── public/
│   │   │   └── images/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── globals.css
│   │   │   │   ├── loading.tsx
│   │   │   │   ├── not-found.tsx
│   │   │   │   ├── (auth)/           # Login, register, reset
│   │   │   │   ├── (site)/           # Páginas públicas
│   │   │   │   ├── admin/            # Painel (páginas, sem lógica de dados)
│   │   │   │   ├── api/
│   │   │   │   │   ├── auth/         # Callback OAuth / cookie de sessão
│   │   │   │   │   └── revalidate/   # Webhook de revalidação de cache
│   │   │   │   └── error/
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts     # fetch() wrapper tipado via @silo/contracts
│   │   │   │   └── auth-client.ts    # Leitura do cookie de sessão
│   │   │   └── proxy.ts
│   │   ├── next.config.ts
│   │   ├── postcss.config.mjs
│   │   ├── tsconfig.json
│   │   ├── vercel.json
│   │   ├── entrypoint.sh
│   │   └── package.json
│   │
│   ├── api/                          # Runtime 2: Express (Backend)
│   │   ├── src/
│   │   │   ├── index.ts              # Bootstrap: Express, middlewares, routers
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # Verifica sessão / cookie better-auth
│   │   │   │   ├── permissions.ts    # RBAC baseado em grupos
│   │   │   │   ├── rateLimit.ts      # express-rate-limit
│   │   │   │   └── validate.ts       # Middleware Zod genérico
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── users.ts
│   │   │   │   ├── groups.ts
│   │   │   │   ├── products.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── incidents.ts
│   │   │   │   ├── tasks.ts
│   │   │   │   ├── contacts.ts
│   │   │   │   ├── help.ts
│   │   │   │   ├── reports.ts
│   │   │   │   ├── chat.ts
│   │   │   │   ├── monitoring.ts
│   │   │   │   ├── upload.ts
│   │   │   │   └── dashboard.ts
│   │   │   ├── services/             # Lógica de negócio (sem Express, testável)
│   │   │   │   ├── userService.ts
│   │   │   │   ├── productService.ts
│   │   │   │   ├── projectService.ts
│   │   │   │   ├── incidentService.ts
│   │   │   │   ├── taskService.ts
│   │   │   │   └── dashboardService.ts
│   │   │   └── lib/
│   │   │       ├── db.ts             # Singleton da conexão @silo/db
│   │   │       ├── kafka.ts          # Kafka Producer
│   │   │       └── uploads.ts        # Armazenamento de arquivos
│   │   ├── uploads/                  # Arquivos enviados pelos usuários
│   │   │   ├── avatars/
│   │   │   ├── contacts/
│   │   │   ├── general/
│   │   │   ├── help/
│   │   │   ├── incidents/
│   │   │   └── projects/
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── worker/                       # Runtime 3: Kafka Consumer
│       ├── src/
│       │   ├── index.ts              # Bootstrap do consumer KafkaJS
│       │   └── lib/
│       │       ├── topicHandlers.ts  # Dispatch para handlers por tópico
│       │       └── handlers/
│       │           ├── productStatusChanged.ts
│       │           ├── taskAssigned.ts
│       │           └── emailRequested.ts
│       ├── tsconfig.json
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── contracts/                    # Tipos de request/response/evento Kafka
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── api-response.ts       # Envelope ApiSuccess / ApiError / Paginated
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── groups.ts
│   │   │   ├── products.ts
│   │   │   ├── projects.ts
│   │   │   ├── incidents.ts
│   │   │   ├── tasks.ts
│   │   │   ├── contacts.ts
│   │   │   ├── help.ts
│   │   │   ├── chat.ts
│   │   │   ├── upload.ts
│   │   │   ├── dataflow.ts
│   │   │   └── kafka-events.ts       # Tipos dos eventos Kafka + KAFKA_TOPICS
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── db/                           # Drizzle ORM: schema, migrations, seed
│   │   ├── src/
│   │   │   ├── index.ts              # Exporta db + todos os schemas
│   │   │   ├── schema/
│   │   │   │   └── index.ts          # Todas as tabelas Drizzle
│   │   │   ├── migrate.ts
│   │   │   ├── reset.ts
│   │   │   ├── seed.ts
│   │   │   ├── seedData.ts
│   │   │   └── seedProducts.ts
│   │   ├── drizzle/                  # Arquivos SQL de migration gerados
│   │   ├── drizzle.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── domain/                       # Regras de negócio puras (sem I/O)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── product-status.ts     # Transições de status de produto
│   │   │   ├── product-activity.ts   # Construção de histórico de atividade
│   │   │   ├── product-pending-email.ts
│   │   │   └── task-history.ts       # Construção de histórico de tarefas
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── core/                         # Utilitários neutros (sem dependência de runtime)
│   │   ├── src/
│   │   │   ├── date-utils.ts
│   │   │   ├── date-config.ts
│   │   │   ├── utils.ts
│   │   │   ├── validation.ts
│   │   │   ├── markdown.ts
│   │   │   ├── constants.ts
│   │   │   ├── config.ts
│   │   │   ├── auth/
│   │   │   │   └── hash.ts           # bcrypt (usado apenas por api)
│   │   │   └── email/
│   │   │       ├── index.ts
│   │   │       ├── sendEmailTemplate.ts
│   │   │       └── types.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── ui/                           # Design System React
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── context/
│   │   │   ├── data/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── config/
│       ├── eslint-config/
│       │   ├── library.js
│       │   ├── next.js
│       │   └── package.json
│       ├── typescript-config/
│       │   ├── base.json
│       │   ├── nextjs.json
│       │   ├── react-library.json
│       │   └── package.json
│       └── tailwind-config/
│           ├── tailwind.config.ts
│           └── package.json
│
├── docs/
│   ├── architecture.md
│   ├── api-endpoints.md
│   └── kafka-events.md
│
├── docker-compose.yml
├── package.json                      # Root: workspaces + scripts Turborepo
└── turbo.json
```

---

## 4. Os Três Runtimes

### 4.1 `apps/web` — Next.js (UI pura)

**Responsabilidade única:** Renderizar a interface.

**Pertence aqui:**
- Páginas (`app/` directory), layouts, loading states, error boundaries.
- Componentes React específicos desta aplicação (os genéricos ficam em `@silo/ui`).
- `lib/api-client.ts`: wrapper de `fetch()` tipado contra `@silo/contracts`.
- `lib/auth-client.ts`: leitura do cookie de sessão para exibir dados do usuário logado.
- `/api/auth/*`: callback OAuth e gerenciamento de cookie (via `better-auth` apontando para `apps/api`).
- `/api/revalidate`: webhook de revalidação de cache do Next.js disparado pela API.

**Não pertence aqui:**
- Nenhuma Route Handler com lógica de negócio ou queries ao banco.
- Nenhum import de `@silo/db` ou `@silo/domain`.
- Nenhuma lógica de hash de senha ou tokens de sessão.
- Nenhuma conexão direta com Kafka.

**`package.json` de `apps/web`:**
```json
{
  "name": "web",
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@silo/contracts": "*",
    "@silo/ui": "*",
    "@silo/core": "*",
    "better-auth": "...",
    "next": "...",
    "react": "...",
    "react-dom": "...",
    "zod": "...",
    "gantt-task-react": "...",
    "lucide-react": "..."
  },
  "devDependencies": {
    "@silo/eslint-config": "*",
    "@silo/typescript-config": "*",
    "tailwindcss": "...",
    "@tailwindcss/postcss": "...",
    "@tailwindcss/forms": "...",
    "@tailwindcss/typography": "..."
  }
}
```

---

### 4.2 `apps/api` — Node.js + Express (Backend)

**Responsabilidade única:** Ser a única interface HTTP de acesso ao banco e ao domínio.

**Pertence aqui:**
- Express app com todos os routers de negócio.
- Middleware de autenticação (verifica sessão emitida pelo `better-auth`).
- Middleware de permissões (RBAC baseado em grupos do banco).
- Middleware de rate limiting por IP e por usuário.
- Middleware de validação com Zod.
- Services: funções puras de negócio que orquestram queries Drizzle, sem dependência do Express.
- Upload de arquivos (multer), armazenamento local ou S3.
- Kafka Producer para eventos assíncronos.

**Estrutura interna por camada:**
```
routes/     → Express Router. Recebe Request, chama Service, devolve Response.
services/   → Lógica de negócio. Sem Express. Testável de forma isolada.
lib/        → Infraestrutura: singleton do banco, producer Kafka, handler de uploads.
middleware/ → Funções Express: auth, RBAC, rate limit, validação Zod.
```

**`package.json` de `apps/api`:**
```json
{
  "name": "api",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@silo/contracts": "*",
    "@silo/db": "*",
    "@silo/domain": "*",
    "@silo/core": "*",
    "express": "^5.x",
    "better-auth": "...",
    "zod": "...",
    "multer": "...",
    "express-rate-limit": "...",
    "kafkajs": "..."
  },
  "devDependencies": {
    "@silo/eslint-config": "*",
    "@silo/typescript-config": "*",
    "tsx": "...",
    "typescript": "..."
  }
}
```

---

### 4.3 `apps/worker` — Node.js (Background Processor)

**Responsabilidade única:** Processar eventos Kafka de forma assíncrona.

**Pertence aqui:**
- Consumer KafkaJS escutando tópicos definidos em `@silo/contracts`.
- Handlers por tópico com lógica de processamento de eventos.
- Acesso ao banco via `@silo/db` para atualizar estados.
- Envio de emails via `@silo/core`.

**Não pertence aqui:**
- Nenhuma rota HTTP exposta externamente.
- Nenhuma lógica de autenticação de usuário.
- Nenhum componente React ou import de `@silo/ui`.

**`package.json` de `apps/worker`:**
```json
{
  "name": "worker",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@silo/contracts": "*",
    "@silo/db": "*",
    "@silo/domain": "*",
    "@silo/core": "*",
    "kafkajs": "..."
  },
  "devDependencies": {
    "@silo/eslint-config": "*",
    "@silo/typescript-config": "*",
    "tsx": "...",
    "typescript": "..."
  }
}
```

---

## 5. Os Pacotes Compartilhados

### 5.1 `@silo/contracts` (novo)

O pacote mais crítico. Define o **contrato formal** entre os três runtimes. Contém apenas tipos TypeScript e schemas Zod — zero dependências de runtime (sem Express, sem React, sem Drizzle).

Tudo que hoje está implícito nos tipos de retorno das API Routes do Next.js passa a ser explícito aqui.

### 5.2 `@silo/db` (renomeado de `packages/database`)

Conteúdo atual de `packages/database/` é transferido para `packages/db/`. O nome do pacote muda de `@silo/database` para `@silo/db`. Todos os arquivos internos permanecem — apenas o nome do pacote e o diretório mudam.

Contém: schema Drizzle, migrations, seed e scripts auxiliares (`activity-status-sync.ts`, `seedData.ts`, `seedPictures.ts`, `seedProducts.ts`, `seedRadars.ts`, `seedTypes.ts`).

Consumidores: `apps/api` e `apps/worker` **somente**. Proibido em `apps/web`.

Exporta:
- `db` — instância do Drizzle com conexão ao Postgres.
- Todos os schemas (`authUser`, `authSession`, `group`, `userGroup`, `product`, `project`, etc.).
- Tipos inferidos (`User`, `Product`, `Project`, etc.).

**`package.json` de `@silo/db`:**
```json
{
  "name": "@silo/db",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "generate": "drizzle-kit generate",
    "migrate": "tsx src/migrate.ts",
    "studio": "drizzle-kit studio",
    "seed": "tsx src/seed.ts",
    "reset": "tsx src/reset.ts"
  },
  "dependencies": {
    "drizzle-orm": "...",
    "pg": "..."
  },
  "devDependencies": {
    "drizzle-kit": "...",
    "tsx": "...",
    "@silo/typescript-config": "*"
  }
}
```

### 5.3 `@silo/domain` (novo, extraído de `src/lib/`)

Regras de negócio puras que hoje estão misturadas em `src/lib/`. Não depende de Express, Next.js, React ou banco de dados.

Conteúdo extraído de `src/lib/`:
- `productStatus.ts` → `product-status.ts` — lógica de transição de status.
- `productActivityHistory.ts` → `product-activity.ts` — construção de histórico.
- `productActivityPendingEmail.ts` → `product-pending-email.ts` — regra de quando disparar email.
- `taskHistory.ts` → `task-history.ts` — construção de histórico de tarefas.

### 5.4 `@silo/core` (simplificado — arquivos já existem, redistribuir)

`@silo/core` já existe. A operação é de **remoção e redistribuição**: arquivos com semântica de domínio saem, arquivos com lógica de backend específico saem. O que permanece são utilitários genuinamente neutros.

**Permanece em `@silo/core`:**

| Arquivo atual em `packages/core/src/` | Mantém |
|---|---|
| `date-utils.ts` | ✅ |
| `date-config.ts` | ✅ |
| `email/` + `send-email.ts` | ✅ (usado por `api` e `worker`) |
| `utils.ts` | ✅ |
| `validation.ts` | ✅ (schemas Zod genéricos) |
| `markdown.ts` | ✅ |
| `constants.ts` | ✅ |
| `config.ts` | ✅ |
| `auth/hash.ts` | ✅ (bcrypt — importado apenas por `apps/api`) |

**Sai de `@silo/core`:**

| Arquivo atual | Destino |
|---|---|
| `api-response.ts` | `packages/contracts/src/api-response.ts` |
| `kafkaRest.ts` | `apps/api/src/lib/kafka.ts` + `apps/worker/src/lib/kafka.ts` |
| `auth/urls.ts` | `apps/api/src/lib/auth-urls.ts` |
| `auth/admin.ts` _(se existir)_ | `apps/api/src/lib/auth.ts` |
| `init.ts` | cada app faz seu próprio bootstrap |
| `dataflow/types.ts` | `packages/contracts/src/dataflow.ts` |
| `product-status.ts` | `packages/domain/src/product-status.ts` |
| `product-activity-history.ts` | `packages/domain/src/product-activity.ts` |
| `product-activity-pending-email.ts` | `packages/domain/src/product-pending-email.ts` |
| `task-history.ts` | `packages/domain/src/task-history.ts` |
- `productStatus.ts`, `taskHistory.ts`, etc. → `@silo/domain`.

**`package.json` de `@silo/core`:**
```json
{
  "name": "@silo/core",
  "exports": {
    "./date": "./src/date-utils.ts",
    "./date-config": "./src/date-config.ts",
    "./email": "./src/email/index.ts",
    "./send-email": "./src/send-email.ts",
    "./utils": "./src/utils.ts",
    "./validation": "./src/validation.ts",
    "./markdown": "./src/markdown.ts",
    "./constants": "./src/constants.ts",
    "./config": "./src/config.ts",
    "./auth/hash": "./src/auth/hash.ts"
  },
  "dependencies": {
    "bcryptjs": "...",
    "date-fns": "...",
    "date-fns-tz": "...",
    "nodemailer": "...",
    "zod": "..."
  }
}
```

### 5.5 `@silo/ui` (extraído de `src/components/`)

Design system React. Componentes burros (dumb components) sem fetch, sem acesso ao banco.

Conteúdo extraído de `src/components/` e `src/hooks/` (hooks de UI puros).

**Não pode importar:** `@silo/db`, `@silo/domain` ou Express. Pode usar `@silo/contracts` apenas para tipos de formulário e exibição.

### 5.6 `@silo/config` (extraído de arquivos de configuração da raiz)

Sem lógica de aplicação. Contém apenas arquivos de tooling:
- `eslint-config/` — regras `library.js` e `next.js`.
- `typescript-config/` — `base.json`, `nextjs.json`, `react-library.json`.
- `tailwind-config/` — tokens de design e tema base.

---

## 6. O Pacote `@silo/contracts`

### 6.1 Por que contratos explícitos são essenciais

Sem contratos, o `fetch()` retorna `any`. Com contratos, o compilador TypeScript garante que o servidor retorna o que o cliente espera:

```typescript
// ❌ Sem contratos (hoje)
const res = await fetch("/api/admin/products")
const data = await res.json() // tipo: any

// ✅ Com contratos
import type { ListProductsResponse } from "@silo/contracts"
const res = await fetch(`${API_URL}/products`)
const data: ListProductsResponse = await res.json()
```

```typescript
// apps/api/src/routes/products.ts
import type { ListProductsResponse } from "@silo/contracts"
router.get("/products", async (req, res) => {
  const products = await productService.list()
  const response: ListProductsResponse = { items: products, total: products.length }
  res.json(response) // TypeScript valida que o contrato está sendo respeitado ✅
})
```

### 6.2 Convenção de nomenclatura

```
{Entidade}Dto              → Tipo de um objeto retornado pela API
List{Entidade}Response     → Resposta de listagem paginada
Get{Entidade}Response      → Resposta de busca por ID
Create{Entidade}Request    → Body de criação (com schema Zod)
Update{Entidade}Request    → Body de atualização (com schema Zod)
{Entidade}CreatedEvent     → Evento Kafka de criação
```

### 6.3 Exemplo de contrato de entidade

```typescript
// packages/contracts/src/products.ts
import { z } from "zod"

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  statusId: z.string().uuid(),
})

export type ProductDto = {
  id: string
  name: string
  description: string | null
  status: { id: string; name: string; color: string }
  createdAt: string
  updatedAt: string
}

export type CreateProductRequest = z.infer<typeof CreateProductSchema>
export type CreateProductResponse = ProductDto
export type ListProductsResponse = PaginatedResponse<ProductDto>
```

### 6.4 Envelope de resposta padrão

```typescript
// packages/contracts/src/api-response.ts
export type ApiSuccess<T> = { success: true; data: T }
export type ApiError = {
  success: false
  error: { code: string; message: string; details?: Record<string, string[]> }
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError
export type PaginatedResponse<T> = ApiSuccess<{
  items: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}>
```

### 6.5 Tipos de eventos Kafka

```typescript
// packages/contracts/src/kafka-events.ts
export const KAFKA_TOPICS = {
  PRODUCT_STATUS_CHANGED: "product.status.changed",
  TASK_ASSIGNED: "task.assigned",
  TASK_STATUS_CHANGED: "task.status.changed",
  EMAIL_REQUESTED: "email.requested",
  INCIDENT_CREATED: "incident.created",
} as const

export type KafkaEvent<T extends string, P> = {
  type: T; payload: P; occurredAt: string; traceId: string
}

export type ProductStatusChangedEvent = KafkaEvent<
  "product.status.changed",
  { productId: string; fromStatus: string; toStatus: string; changedBy: string }
>

export type DomainEvent = ProductStatusChangedEvent | TaskAssignedEvent | EmailRequestedEvent
```

---

## 7. Configurações de Tooling

### 7.1 `@silo/typescript-config`

```json
// packages/config/typescript-config/base.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "composite": false, "declaration": true, "declarationMap": true,
    "esModuleInterop": true, "forceConsistentCasingInFileNames": true,
    "isolatedModules": true, "moduleResolution": "node",
    "skipLibCheck": true, "strict": true
  },
  "exclude": ["node_modules"]
}
```

```json
// packages/config/typescript-config/nextjs.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "preserve", "module": "ESNext", "moduleResolution": "bundler",
    "target": "ESNext", "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": true, "plugins": [{ "name": "next" }]
  }
}
```

### 7.2 `@silo/eslint-config`

```javascript
// packages/config/eslint-config/library.js
module.exports = {
  extends: ["eslint:recommended"],
  plugins: ["simple-import-sort"],
  rules: { "simple-import-sort/imports": "error", "simple-import-sort/exports": "error" },
  env: { node: true },
}
```

### 7.3 `next.config.ts` no monorepo

O Next.js não transpila pacotes externos por padrão. Obrigatório declarar:

```typescript
// apps/web/next.config.ts
const nextConfig = {
  transpilePackages: ["@silo/ui", "@silo/core", "@silo/contracts"],
  // @silo/db NÃO entra aqui — web não deve importá-lo
}
export default nextConfig
```

### 7.4 Tailwind no monorepo

O `apps/web` precisa incluir os caminhos do `@silo/ui` no seu scan de classes:

```typescript
// apps/web/tailwind.config.ts (ou postcss via @tailwindcss/postcss)
content: [
  "./src/**/*.{js,ts,jsx,tsx,mdx}",
  "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
],
```

---

## 8. Fluxo de Dados e Comunicação

### 8.1 Fluxo síncrono

```
Browser → apps/web (SSR/RSC fetch) → apps/api (Express) → @silo/db (Drizzle) → PostgreSQL
```

```typescript
// apps/web/src/app/admin/products/page.tsx
import { apiClient } from "@/lib/api-client"
import type { ListProductsResponse } from "@silo/contracts"

export default async function ProductsPage() {
  const { data } = await apiClient.get<ListProductsResponse>("/products")
  return <ProductTable products={data.items} />
}
```

O `apiClient` lê `NEXT_PUBLIC_API_URL` e injeta o cookie de sessão nos headers de cada request.

### 8.2 Fluxo assíncrono via Kafka

```
apps/api (Producer) → Kafka → apps/worker (Consumer) → @silo/db → PostgreSQL
                                                       ↓
                                                  Email via SMTP
```

Ao mudar o status de um produto, a API:
1. Persiste no banco.
2. Publica evento `product.status.changed` no Kafka.
3. Responde ao cliente imediatamente (sem esperar o side-effect).

O Worker recebe o evento e executa email, log de histórico e sync de atividade de forma assíncrona.

### 8.3 Padrão de migração de imports

| Import atual (apps/web) | Import no estado alvo |
|---|---|
| `import { db } from "@silo/database"` | Removido do web. Somente em `apps/api` e `apps/worker` via `@silo/db` |
| `import { ... } from "@silo/database/schema"` | Removido do web. Somente em `apps/api` e `apps/worker` via `@silo/db/schema` |
| `import { ... } from "@silo/core/api-response"` | `import { ... } from "@silo/contracts"` |
| `import { ... } from "@silo/core/kafka-rest"` | Removido do web. Vai para `apps/api/src/lib/kafka.ts` |
| `import { ... } from "@silo/core/dataflow"` | `import { ... } from "@silo/contracts/dataflow"` |
| `import { ... } from "@silo/core/product-status"` | Removido do web. Vai para `@silo/domain/product-status` |
| `import { ... } from "@silo/core/task-history"` | Removido do web. Vai para `@silo/domain/task-history` |
| `import { requirePermissionAuthUser } from "@/lib/permissions"` | Removido do web. Vira middleware Express em `apps/api` |
| `import { ... } from "@/lib/auth/server"` | Removido do web. Vai para `apps/api/src/lib/auth.ts` |
| `import { ... } from "@/lib/localUploads"` | Removido do web. Vai para `apps/api/src/lib/uploads.ts` |
| `import { ... } from "@/lib/profileImage"` | Removido do web. Vai para `apps/api/src/lib/uploads.ts` |
| `import { ... } from "@/lib/rateLimit"` | Removido do web. Vai para `apps/api/src/middleware/rateLimit.ts` |

---

## 9. Banco de Dados Centralizado

### 9.1 Acesso exclusivo

```
apps/api    → @silo/db → PostgreSQL
apps/worker → @silo/db → PostgreSQL
apps/web    → ❌ proibido
```

### 9.2 Migrações

Centralizadas em `packages/db/drizzle/`. O CI/CD roda `db:migrate` antes de cada deploy da API.

```json
// package.json (raiz)
{
  "scripts": {
    "db:generate": "npm run generate -w @silo/db",
    "db:migrate": "npm run migrate -w @silo/db",
    "db:studio": "npm run studio -w @silo/db",
    "db:seed": "npm run seed -w @silo/db"
  }
}
```

### 9.3 Connection pooling em produção

Recomendado **PgBouncer** na frente do PostgreSQL. O Drizzle conecta ao PgBouncer, não diretamente ao Postgres, para gerenciar o pool entre instâncias de `api` e `worker`.

---

## 10. Autenticação no Novo Modelo

### 10.1 Estado atual

`better-auth` está configurado em `apps/web/src/lib/auth/server.ts`. O arquivo é complexo: usa adapter Drizzle, plugin `emailOTP`, middleware de auth customizado, hooks de `onSignIn`/`onSignUp`, processamento de imagem de perfil e adição de usuário a grupos padrão. O handler HTTP fica em `apps/web/src/app/api/auth/[...all]/route.ts`.

Arquivos de auth no `apps/web/src/lib/auth/`:
- `server.ts` — instância principal do `better-auth`
- `client.ts` — SDK cliente (`createAuthClient`)
- `hash.ts` — wrapper de bcrypt (deve ir para `@silo/core/auth/hash`)
- `urls.ts` — helper de URLs da auth (deve ir para `apps/api`)
- `validate.ts` — validação de domínio de email
- `user-groups.ts` — adiciona usuário ao grupo padrão após cadastro
- `admin.ts` — helper `requireAdmin`
- `i18n.ts` — internacionalização de mensagens de auth
- `rate-limits.ts` — constantes de duração de sessão
- `social-utils.ts` — helpers para OAuth social

### 10.2 Solução

Mover a **instância servidor** do `better-auth` para `apps/api`. O `apps/web` fica apenas com o SDK cliente:

```
apps/api/src/lib/auth.ts          → instância do better-auth (server.ts atual)
apps/api/src/routes/auth.ts       → handler Express do better-auth
apps/api/src/middleware/auth.ts   → verifica sessão em rotas protegidas
apps/web/src/lib/auth/client.ts   → permanece (SDK cliente)
```

Arquivos de suporte migram para `apps/api/src/lib/`:
- `validate.ts` → `apps/api/src/lib/auth-validate.ts`
- `user-groups.ts` → `apps/api/src/lib/auth-user-groups.ts`
- `i18n.ts` → `apps/api/src/lib/auth-i18n.ts`
- `social-utils.ts` → `apps/api/src/lib/auth-social.ts`
- `rate-limits.ts` → `apps/api/src/lib/auth-rate-limits.ts`
- `urls.ts` → `apps/api/src/lib/auth-urls.ts`
- `admin.ts` → integrado em `apps/api/src/middleware/permissions.ts`

### 10.3 Fluxo de autenticação

```
1. Usuário submete login em apps/web
2. apps/web: POST → apps/api/auth/sign-in (via api-client)
3. apps/api: better-auth valida credenciais, cria sessão, retorna cookie httpOnly
4. Browser armazena cookie
5. apps/web inclui cookie em todas as requests para apps/api
6. apps/api: middleware auth verifica cookie antes de cada rota protegida
7. apps/api: middleware permissions verifica grupos e permissões do usuário
```

### 10.4 Migração do RBAC

A lógica de `apps/web/src/lib/permissions/index.ts` (que verifica `group_permissions` no banco) migra integralmente para `apps/api/src/middleware/permissions.ts`. A função `requirePermissionAuthUser` se torna middleware Express, deixando de ser chamada dentro de cada route handler.

### 10.5 Configuração CORS

```typescript
// apps/api/src/index.ts
app.use(cors({ origin: process.env.WEB_URL, credentials: true }))
// better-auth também precisa de:
// trustedOrigins: [process.env.WEB_URL]
```

---

## 11. Upload de Arquivos

### 11.1 Estado atual

Uploads em `src/app/api/upload/` com arquivos salvos em `uploads/` na raiz do projeto.

### 11.2 Estado alvo

- `apps/api/src/routes/upload.ts` — endpoint multer.
- `apps/api/src/lib/uploads.ts` — lógica de armazenamento (local ou S3).
- `apps/api/uploads/` — diretório de arquivos (volume Docker persistente em produção).
- `apps/web` exibe arquivos via `${API_URL}/uploads/:categoria/:arquivo`.

### 11.3 Migração dos arquivos físicos

Os arquivos em `uploads/` (raiz atual) devem ser movidos para `apps/api/uploads/`. As URLs no banco precisam ser atualizadas com um script de migração antes da virada.

---

## 12. Kafka e o Worker

### 12.1 Padrão atual: Kafka REST Proxy

O worker atual **não usa KafkaJS diretamente**. Usa um Kafka REST Proxy via `@silo/core/kafkaRest`, que encapsula chamadas HTTP para o proxy Confluent. Esse padrão deve ser preservado — a única mudança é que os tipos dos eventos passam a vir de `@silo/contracts`.

O módulo `kafkaRest.ts` deixa `@silo/core` e vai para um local privado de cada app:
- `apps/api/src/lib/kafka.ts` — funções de **produção** de mensagens
- `apps/worker/src/lib/kafka.ts` — funções de **consumo** de mensagens

### 12.2 Producer na API

```typescript
// apps/api/src/lib/kafka.ts
import { produceRecordRest } from "./kafkaRestClient" // extraído de @silo/core
import { KAFKA_TOPICS } from "@silo/contracts"
import type { DomainEvent } from "@silo/contracts"

export async function publishEvent(topic: string, event: DomainEvent) {
  await produceRecordRest(topic, JSON.stringify(event))
}
```

### 12.3 Consumer no Worker

```typescript
// apps/worker/src/index.ts
import { KAFKA_TOPICS } from "@silo/contracts"
import type { ProductStatusChangedEvent } from "@silo/contracts"
// Usa as funções do kafkaRest (movidas de @silo/core para apps/worker/src/lib/kafka.ts)
import { createRestConsumer, fetchRecordsRest, commitOffsetsRest } from "./lib/kafka"
import { getHandlerForTopic } from "./lib/topicHandlers"
```

Os handlers existentes em `apps/worker/src/lib/handlers/` (`modelHandler.ts`, `monitoringHandler.ts`) são mantidos e tipados com os tipos de `@silo/contracts`.

### 12.4 Tópicos tipados

Todo tópico Kafka deve ser declarado em `@silo/contracts/src/kafka-events.ts` e importado via `KAFKA_TOPICS`. Strings hardcoded de tópico são proibidas em qualquer runtime.

O Worker **não expõe porta HTTP**. Não precisa de nginx, sem `EXPOSE` no Dockerfile.

---

## 13. Configuração do Turborepo e npm Workspaces

### 13.1 `package.json` raiz

```json
{
  "name": "silo-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "packages/config/*"
  ],
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:generate": "npm run generate -w @silo/db",
    "db:migrate": "npm run migrate -w @silo/db",
    "db:studio": "npm run studio -w @silo/db",
    "db:seed": "npm run seed -w @silo/db",
    "dev:web": "turbo run dev --filter=web",
    "dev:api": "turbo run dev --filter=api",
    "dev:worker": "turbo run dev --filter=worker"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "packageManager": "npm@11.x"
}
```

### 13.2 `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^lint"] },
    "typecheck": { "dependsOn": ["^typecheck"] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "db:migrate": { "cache": false }
  }
}
```

### 13.3 Ordem de build resolvida pelo Turborepo

```
1. @silo/config              — sem dependências internas
2. @silo/contracts           — sem dependências internas
3. @silo/core                — depende de @silo/config
4. @silo/db                  — depende de @silo/config
5. @silo/domain              — depende de @silo/contracts, @silo/core
6. @silo/ui                  — depende de @silo/core, @silo/config
7. apps/api                  — depende de @silo/contracts, @silo/db, @silo/domain, @silo/core
8. apps/worker               — depende de @silo/contracts, @silo/db, @silo/domain, @silo/core
9. apps/web                  — depende de @silo/contracts, @silo/ui, @silo/core
```

### 13.4 Instalação de dependências

```bash
# Instalar no workspace correto
npm install express -w api
npm install lucide-react -w web
npm install kafkajs -w worker
npm install zod -w @silo/contracts
```

---

## 14. Dockerização dos Runtimes

### 14.1 `apps/web/Dockerfile`

```dockerfile
FROM node:22-alpine AS base
RUN npm install -g turbo

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune web --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN npm install
COPY --from=pruner /app/out/full/ .
RUN npx turbo run build --filter=web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=installer /app/apps/web/.next/standalone ./
COPY --from=installer /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

### 14.2 `apps/api/Dockerfile`

```dockerfile
FROM node:22-alpine AS base
RUN npm install -g turbo

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune api --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN npm install
COPY --from=pruner /app/out/full/ .
RUN npx turbo run build --filter=api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=installer /app/apps/api/dist ./dist
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/api/package.json .
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### 14.3 `apps/worker/Dockerfile`

Idêntico ao da API, substituindo `api` por `worker`. Sem `EXPOSE` (sem porta HTTP).

### 14.4 `docker-compose.yml`

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: silo
      POSTGRES_USER: silo
      POSTGRES_PASSWORD: silo
    volumes:
      - postgres_data:/var/lib/postgresql/data

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-kafka:latest
    ports: ["9092:9092"]
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
    depends_on: [zookeeper]

  api:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    ports: ["3001:3001"]
    environment:
      DATABASE_URL: postgresql://silo:silo@postgres:5432/silo
      KAFKA_BROKER: kafka:9092
      WEB_URL: http://web:3000
    volumes:
      - uploads_data:/app/uploads
    depends_on: [postgres, kafka]

  worker:
    build: { context: ., dockerfile: apps/worker/Dockerfile }
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://silo:silo@postgres:5432/silo
      KAFKA_BROKER: kafka:9092
    depends_on: [kafka, postgres]

  web:
    build: { context: ., dockerfile: apps/web/Dockerfile }
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://api:3001
    depends_on: [api]

volumes:
  postgres_data:
  uploads_data:
```

---

## 15. Variáveis de Ambiente

### 15.1 Segregação por runtime

| Variável | web | api | worker |
|---|:---:|:---:|:---:|
| `DATABASE_URL` | ❌ | ✅ | ✅ |
| `KAFKA_BROKER` | ❌ | ✅ | ✅ |
| `BETTER_AUTH_SECRET` | ❌ | ✅ | ❌ |
| `SMTP_HOST` / `SMTP_*` | ❌ | ✅ | ✅ |
| `NEXT_PUBLIC_API_URL` | ✅ | ❌ | ❌ |
| `WEB_URL` | ❌ | ✅ | ❌ |
| `UPLOAD_DIR` | ❌ | ✅ | ❌ |

### 15.2 Arquivos `.env` por app

```
apps/web/.env.local
apps/api/.env.local
apps/worker/.env.local
packages/db/.env.local     ← apenas para db:migrate e db:studio localmente
```

Não existe `.env` na raiz com segredos. A validação das variáveis via Zod deve ocorrer no `index.ts` de cada app, no boot, antes de qualquer uso.

---

## 16. Pipeline de CI/CD

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: ["main"]
  pull_request:
    types: [opened, synchronize]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 2 }

      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'npm' }

      - run: npm ci

      - name: Typecheck
        run: npx turbo run typecheck

      - name: Lint
        run: npx turbo run lint

      - name: Build
        run: npx turbo run build

  deploy:
    needs: ci
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: npm run db:migrate   # sempre antes do deploy da API
      - run: docker compose up -d --build api worker web
```

O Turborepo usa cache remoto no CI: se apenas `apps/web` mudou, o build de `apps/api` e `apps/worker` é lido do cache em segundos.

---

## 17. Fases de Migração

A migração parte do monólito e chega diretamente na arquitetura final com 3 runtimes. Nenhuma fase intermediária cria o monorepo "pela metade" — cada fase entrega valor independente.

---

### Fase 0 — Setup da Infraestrutura Raiz
**Objetivo:** Criar a estrutura de monorepo sem mover nada ainda.

- [ ] Criar branch `feature/upgrade-monorepo`.
- [ ] Mover o conteúdo atual do projeto para `tmp-legacy/` temporariamente.
- [ ] Na raiz, criar `package.json` com `workspaces`, instalar `turbo`.
- [ ] Criar pastas `apps/`, `packages/`, `docs/`.
- [ ] Criar `turbo.json` com os tasks básicos.
- [ ] Criar `apps/web/` e mover `tmp-legacy/src/`, `public/`, `next.config.ts`, etc.
- [ ] Criar `apps/worker/` vazio com `package.json` e estrutura básica.
- [ ] Criar `apps/api/` com Express mínimo (`GET /health` → 200).
- [ ] Verificar que `npm run dev` inicia os apps sem erros.

**Critério de conclusão:** Os 3 apps sobem com `npm run dev`.

---

### Fase 1 — Extrair Pacotes de Configuração
**Objetivo:** Isolar tooling em pacotes reutilizáveis.

- [ ] Criar `packages/config/typescript-config/` com `base.json`, `nextjs.json`, `react-library.json`.
- [ ] Criar `packages/config/eslint-config/` com `library.js` e `next.js`.
- [ ] Criar `packages/config/tailwind-config/` com `tailwind.config.ts`.
- [ ] Atualizar `tsconfig.json` de `apps/web` para estender `@silo/typescript-config/nextjs.json`.
- [ ] Atualizar `tsconfig.json` de `apps/worker` e `apps/api` para estender `@silo/typescript-config/base.json`.
- [ ] Verificar `npm run typecheck` em todos os workspaces.

**Critério de conclusão:** `npm run typecheck` passa em todos os workspaces.

---

### Fase 2 — Extrair `@silo/contracts`
**Objetivo:** Criar o contrato formal entre os runtimes.

- [ ] Criar `packages/contracts/` com `package.json` e `tsconfig.json`.
- [ ] Criar `packages/contracts/src/api-response.ts` (extraído de `src/lib/api-response.ts`).
- [ ] Criar `packages/contracts/src/kafka-events.ts` com `KAFKA_TOPICS` e tipos de eventos.
- [ ] Criar `packages/contracts/src/dataflow.ts` (extraído de `src/lib/dataflow/types.ts`).
- [ ] Criar DTOs e schemas Zod para cada entidade: users, groups, products, projects, incidents, tasks, contacts, help, chat, upload.
- [ ] Adicionar `@silo/contracts` como dependência de `apps/web`, `apps/api`, `apps/worker`.
- [ ] Verificar `npm run typecheck`.

**Critério de conclusão:** `@silo/contracts` exporta todos os tipos e schemas. `npm run typecheck` verde.

---

### Fase 3 — Extrair `@silo/core` e `@silo/domain`
**Objetivo:** Isolar utilitários neutros e regras de negócio do `src/lib/`.

- [ ] Criar `packages/core/` e mover utilitários neutros (tabela da seção 5.4).
- [ ] Criar `packages/domain/` e mover lógica de domínio: `product-status`, `product-activity`, `task-history`.
- [ ] Atualizar imports no `apps/web`: substituir `@/lib/dateUtils` → `@silo/core/date`, etc.
- [ ] Verificar que `apps/worker` usa `@silo/core` e `@silo/domain` corretamente.
- [ ] Remover os arquivos migrados de `apps/web/src/lib/`.

**Critério de conclusão:** `apps/web/src/lib/` não contém mais utilitários genéricos. `npm run typecheck` verde.

---

### Fase 4 — Extrair `@silo/db`
**Objetivo:** Isolar o banco de dados em pacote dedicado.

- [ ] Criar `packages/db/` e mover `src/lib/db/`, `drizzle.config.ts`, `drizzle/` (migrations).
- [ ] Criar `packages/db/src/index.ts` exportando `db` e todos os schemas.
- [ ] Ajustar `drizzle.config.ts` para os novos caminhos relativos.
- [ ] Adicionar `@silo/db` como dependência de `apps/api` e `apps/worker`.
- [ ] **Remover** `@silo/db` (ou qualquer import de banco) de `apps/web`.
- [ ] Testar `npm run db:migrate` e `npm run db:studio` da raiz.

**Critério de conclusão:** `apps/web/package.json` não contém nenhuma dependência de banco. `npm run db:migrate` funciona.

---

### Fase 5 — Extrair `@silo/ui`
**Objetivo:** Isolar o design system React.

- [ ] Criar `packages/ui/` e mover `src/components/`, `src/hooks/` (hooks de UI puros), `src/context/`, `src/data/`, `src/lib/` (utils de UI).
- [ ] Migrar CSS global e arquivos de estilo base.
- [ ] Atualizar imports em `apps/web`: `@/components/Button` → `@silo/ui/components/Button`.
- [ ] Configurar `transpilePackages` no `apps/web/next.config.ts`.
- [ ] Configurar `content` do Tailwind em `apps/web` para incluir `../../packages/ui/src/**`.

**Critério de conclusão:** `npm run build -w web` passa. UI renderiza corretamente.

---

### Fase 6 — Construir a `apps/api` (Express)
**Objetivo:** Mover toda a lógica de negócio das API Routes do Next.js para o Express.

Migrar por domínio, um de cada vez. Durante a migração, as API Routes do Next.js funcionam como **proxies temporários** para a nova API:

```typescript
// apps/web/src/app/api/admin/products/route.ts (proxy temporário)
import { NextRequest } from "next/server"
export async function GET(req: NextRequest) {
  return fetch(`${process.env.API_URL}/products`, {
    headers: { cookie: req.headers.get("cookie") ?? "" },
  })
}
```

Checklist por domínio:
- [ ] Implementar `apps/api/src/middleware/auth.ts` (verificação de sessão `better-auth`).
- [ ] Implementar `apps/api/src/middleware/permissions.ts` (RBAC).
- [ ] Implementar `apps/api/src/middleware/rateLimit.ts`.
- [ ] Implementar `apps/api/src/middleware/validate.ts` (Zod middleware genérico).
- [ ] Mover `better-auth` para `apps/api/src/routes/auth.ts`.
- [ ] Migrar `src/app/api/admin/users/` → `apps/api/src/routes/users.ts` + `services/userService.ts`.
- [ ] Migrar `src/app/api/admin/groups/` → `apps/api/src/routes/groups.ts`.
- [ ] Migrar `src/app/api/admin/products/` → `apps/api/src/routes/products.ts`.
- [ ] Migrar `src/app/api/admin/projects/` → `apps/api/src/routes/projects.ts`.
- [ ] Migrar `src/app/api/admin/incidents/` → `apps/api/src/routes/incidents.ts`.
- [ ] Migrar `src/app/api/admin/tasks/` → `apps/api/src/routes/tasks.ts`.
- [ ] Migrar `src/app/api/admin/contacts/` → `apps/api/src/routes/contacts.ts`.
- [ ] Migrar `src/app/api/admin/help/` → `apps/api/src/routes/help.ts`.
- [ ] Migrar `src/app/api/admin/chat/` → `apps/api/src/routes/chat.ts`.
- [ ] Migrar `src/app/api/admin/dashboard/` → `apps/api/src/routes/dashboard.ts` + `services/dashboardService.ts`.
- [ ] Migrar `src/app/api/admin/reports/` → `apps/api/src/routes/reports.ts`.
- [ ] Migrar `src/app/api/admin/monitoring/` → `apps/api/src/routes/monitoring.ts`.
- [ ] Migrar `src/app/api/upload/` → `apps/api/src/routes/upload.ts`.
- [ ] Mover `src/lib/localUploads.ts`, `src/lib/profileImage.ts` → `apps/api/src/lib/uploads.ts`.
- [ ] Mover `src/lib/kafkaRest.ts` → `apps/api/src/lib/kafka.ts`.

**Critério de conclusão:** Todas as rotas respondendo via `apps/api`. Proxies temporários funcionando. Testes manuais de cada domínio.

---

### Fase 7 — Atualizar o Frontend para Consumir a API
**Objetivo:** Substituir chamadas internas do Next.js por `fetch()` tipado para `apps/api`.

- [ ] Criar `apps/web/src/lib/api-client.ts` com wrapper de `fetch()` tipado.
- [ ] Substituir todos os `fetch("/api/admin/...")` por `apiClient.get/post/put/delete(...)`.
- [ ] Configurar `NEXT_PUBLIC_API_URL` em `apps/web/.env.local`.
- [ ] Remover `apps/web/src/lib/rateLimit.ts` (movido para `apps/api`).
- [ ] Remover proxies temporários criados na Fase 6.
- [ ] Remover `apps/web/src/app/api/admin/` por completo.
- [ ] Remover `@silo/db` de `apps/web/package.json` (se ainda presente).

**Critério de conclusão:** `apps/web/src/app/api/admin/` deletado. `apps/web/package.json` sem `@silo/db`.

---

### Fase 8 — Limpeza e Validação Final
**Objetivo:** Garantir que as fronteiras estão respeitadas e o sistema funciona de ponta a ponta.

- [ ] Auditar imports: nenhum arquivo em `apps/web` importa `@silo/db` ou `@silo/domain`.
- [ ] Mover `src/uploads/` para `apps/api/uploads/`. Atualizar URLs no banco.
- [ ] Remover `tmp-legacy/` do repositório.
- [ ] Rodar `npm run typecheck` — zero erros em todos os workspaces.
- [ ] Rodar `npm run lint` — zero warnings em todos os workspaces.
- [ ] Testar fluxo completo com `docker compose up`.
- [ ] Testar autenticação completa (login → sessão → rotas protegidas → logout).
- [ ] Atualizar `docs/api-endpoints.md` com todos os endpoints.
- [ ] Atualizar `docs/kafka-events.md` com todos os tópicos.
- [ ] Atualizar CI/CD para 3 serviços Docker.

---

## 18. Checklist de Migração por Domínio

### Autenticação
- [ ] `better-auth` configurado em `apps/api/src/routes/auth.ts`
- [ ] Cookie httpOnly emitido por `apps/api`
- [ ] `apps/web` usa apenas SDK client-side do `better-auth`
- [ ] Middleware `auth.ts` em `apps/api` protegendo todas as rotas `/admin/*`
- [ ] CORS configurado com `trustedOrigins`

### Produtos
- [ ] CRUD em `apps/api/src/routes/products.ts` + `services/productService.ts`
- [ ] Lógica de status em `@silo/domain/product-status.ts`
- [ ] Histórico de atividade em `@silo/domain/product-activity.ts`
- [ ] Evento `product.status.changed` publicado no Kafka
- [ ] Worker processando o evento para envio de email

### Projetos
- [ ] CRUD em `apps/api/src/routes/projects.ts`
- [ ] Dados para Gantt retornando contrato tipado `@silo/contracts`

### Tarefas
- [ ] CRUD em `apps/api/src/routes/tasks.ts`
- [ ] Histórico em `@silo/domain/task-history.ts`
- [ ] Evento `task.assigned` publicado no Kafka

### Incidentes e Soluções
- [ ] CRUD em `apps/api/src/routes/incidents.ts`
- [ ] Evento `incident.created` publicado no Kafka

### Usuários e Grupos
- [ ] CRUD em `apps/api/src/routes/users.ts` e `groups.ts`
- [ ] RBAC baseado em `group.role` via `middleware/permissions.ts`

### Upload
- [ ] Endpoint multer em `apps/api/src/routes/upload.ts`
- [ ] Arquivos em `apps/api/uploads/` (volume persistente)
- [ ] `apps/web` exibe imagens via `${API_URL}/uploads/...`

### Dashboard e Reports
- [ ] Queries agregadas em `apps/api/src/services/dashboardService.ts`
- [ ] Nenhuma lógica de agregação no frontend

---

## 19. Convenções e Regras de Fronteira

### 19.1 Regras de importação

| Workspace | Pode importar |
|---|---|
| `apps/web` | `@silo/contracts`, `@silo/ui`, `@silo/core` |
| `apps/api` | `@silo/contracts`, `@silo/db`, `@silo/domain`, `@silo/core` |
| `apps/worker` | `@silo/contracts`, `@silo/db`, `@silo/domain`, `@silo/core` |
| `@silo/ui` | `@silo/core`, `@silo/contracts` (só tipos) |
| `@silo/domain` | `@silo/contracts`, `@silo/core` |
| `@silo/db` | `@silo/config` apenas |
| `@silo/contracts` | nenhum pacote interno |
| `@silo/core` | `@silo/config` apenas |

Essas regras podem ser enforçadas via `eslint-plugin-boundaries`.

### 19.2 Regra dos Services

Services em `apps/api/src/services/` são funções **sem dependência do Express**:

```typescript
// ✅ Correto — testável sem servidor
export async function listProducts(filters: ListProductsRequest): Promise<ProductDto[]>

// ❌ Errado — acoplado ao HTTP
export async function listProducts(req: Request, res: Response): Promise<void>
```

### 19.3 Regra dos Eventos Kafka

Toda string de tópico Kafka **deve ser importada de `KAFKA_TOPICS`** em `@silo/contracts`. Strings hardcoded de tópico são proibidas.

### 19.4 Nomenclatura de arquivos

- `routes/*.ts` → Express Router
- `services/*.ts` → Lógica de negócio testável
- `middleware/*.ts` → Função Express middleware
- `handlers/*.ts` → Handler de evento Kafka (apenas em `apps/worker`)
- Componentes React: `PascalCase.tsx`
- Todo o resto: `kebab-case.ts`

### 19.5 Evitar dependências circulares

Um pacote em `packages/*` **nunca** importa de `apps/*`. O grafo de dependência é sempre unidirecional: `apps/* → packages/*`.

---

## 20. Boas Práticas e Armadilhas do Next.js em Monorepo

### 20.1 `transpilePackages` obrigatório

Sem isso, o Next.js não processa TypeScript raw dos pacotes internos:

```typescript
// apps/web/next.config.ts
const nextConfig = {
  transpilePackages: ["@silo/ui", "@silo/core", "@silo/contracts"],
}
```

### 20.2 Tailwind precisa ver todas as classes

Classes do `@silo/ui` são expurgadas se o Tailwind não varrer o pacote:

```typescript
content: [
  "./src/**/*.{js,ts,jsx,tsx,mdx}",
  "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
],
```

### 20.3 Instalação de dependências sempre no workspace correto

```bash
# ✅
npm install express -w api
# ❌ nunca na raiz para apps específicos
npm install express
```

### 20.4 Cache do Turborepo não funciona com `.env`

Variáveis de ambiente em `.env.local` invalidam o cache corretamente via `globalDependencies`. Nunca usar `process.env` fora do app que possui a variável — pacotes compartilhados não leem `.env`.

### 20.5 `output: standalone` no Next.js

Para produção, configurar no `next.config.ts`:

```typescript
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@silo/ui", "@silo/core", "@silo/contracts"],
}
```

O `standalone` output do Next.js inclui apenas as dependências necessárias, produzindo uma imagem Docker substancialmente menor.

---

## 21. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|:---:|:---:|---|
| Latência adicional web → api | Alta | Médio | HTTP/2, keep-alive, co-localizar api e web na mesma rede Docker |
| Sessão não propagada corretamente | Média | Alto | Validar fluxo completo de auth antes de avançar para Fase 6 |
| Uploads com URLs quebradas | Alta | Médio | Script de migração de URLs antes de remover `src/uploads/` |
| TypeScript errors em cadeia ao mover arquivos | Média | Médio | Migrar um pacote por fase, manter `typecheck` verde a cada PR |
| Worker perdendo eventos durante deploy | Média | Alto | `autoCommit: false` no consumer + commit manual após processamento |
| CORS bloqueando requests web → api | Alta | Médio | Configurar `cors()` com `origin + credentials: true` antes de qualquer teste |
| Turborepo cache stale em CI | Baixa | Baixo | Usar `turbo --force` em pipelines de deploy |
| Dependência circular acidental entre pacotes | Média | Médio | ESLint `boundaries` + `npm ls` para auditar o grafo |

---

## 22. Diagrama de Dependências

```
                        ┌─────────────────┐
                        │  @silo/config   │
                        │ (eslint/ts/tw)  │
                        └────────┬────────┘
                                 │
           ┌─────────────────────┼──────────────────────┐
           ▼                     ▼                      ▼
 ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
 │ @silo/contracts  │  │   @silo/core     │  │    @silo/db      │
 │ (tipos + schemas)│  │  (utils neutros) │  │ (drizzle/schema) │
 └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
          │                     │                      │
          └──────────┬──────────┘                      │
                     ▼                                 │
          ┌──────────────────┐                         │
          │  @silo/domain    │                         │
          │ (regras negócio) │                         │
          └────────┬─────────┘                         │
                   │                                   │
  ┌────────────────┼───────────────────────────────────┤
  │                │                                   │
  ▼                ▼                                   ▼
┌──────┐    ┌──────────┐                       ┌──────────┐
│ web  │    │   api    │◄──────────────────────│  worker  │
│ Next │    │ Express  │     (Kafka events)     │ KafkaJS  │
└──────┘    └──────────┘                       └──────────┘
  │                │                                   │
  @silo/contracts  @silo/contracts                      @silo/contracts
  @silo/ui         @silo/db                             @silo/db
  @silo/core       @silo/domain                         @silo/domain
                   @silo/core                           @silo/core

━━━━━ apps/web NUNCA importa @silo/db nem @silo/domain ━━━━━
```

---

## Conclusão

Esta arquitetura transforma o projeto de um **Next.js que faz tudo** em três runtimes com fronteiras explícitas:

- **`web`** não tem `DATABASE_URL`. Uma vulnerabilidade XSS não expõe o banco.
- **`api`** é o único ponto de contato com o PostgreSQL. Middleware centralizado garante consistência.
- **`worker`** não expõe porta HTTP. Não pode ser atacado diretamente.
- **`@silo/contracts`** documenta a interface da API via tipos TypeScript — documentação que o compilador verifica.
- **`@silo/db`** é a única fonte de verdade sobre o schema. Zero divergência entre apps.

O custo é real: 3 processos, mais complexidade operacional, latência interna. Para o perfil do Silo — múltiplos domínios de negócio, background jobs assíncronos, controle granular de permissões — o custo se paga na primeira vez que for necessário fazer rollback isolado do frontend, ou escalar a API sem replicar a UI.

---

Fim
