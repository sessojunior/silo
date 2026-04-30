# Plano de Execução por Sprints — Upgrade Silo (Monorepo + 3 Runtimes)

> Ponto de partida: **aplicação Next.js monolítica** (sem monorepo, sem Turborepo). Todo o código em um único diretório com `src/`, `public/`, `uploads/`, `drizzle/`.
>
> Destino final: Monorepo Turborepo com `apps/web` (Next.js UI), `apps/api` (Express), `apps/worker` (Kafka Consumer) e pacotes `packages/contracts`, `packages/db`, `packages/domain`, `packages/core`, `packages/ui`, `packages/config`.

---

## Índice de Sprints

| Sprint | Nome | Foco |
|---|---|---|
| [S1](#s1--monorepo-scaffold--tooling) | Monorepo Scaffold + Tooling | Turborepo, workspaces, packages/config |
| [S2](#s2--pacotes-de-dados-e-utilit%C3%A1rios) | Pacotes de Dados e Utilitários | packages/db + packages/core |
| [S3](#s3--design-system-e-tipos) | Design System e Tipos | packages/ui + packages/types |
| [S4](#s4--contratos-e-dom%C3%ADnio) | Contratos e Domínio | packages/contracts + packages/domain |
| [S5](#s5--appsapi-scaffold--auth--middleware) | apps/api: Scaffold + Auth + Middleware | Bootstrap Express, better-auth, RBAC |
| [S6](#s6--appsapi-produtos-projetos-tarefas-incidentes) | apps/api: Produtos, Projetos, Tarefas, Incidentes | Core business routes |
| [S7](#s7--appsapi-contatos-ajuda-chat-dashboard-reports-monitoring-upload) | apps/api: Demais Rotas | Todos os domínios restantes |
| [S8](#s8--appsweb-consume-a-api) | apps/web: Consome a API | api-client, remover DB do web |
| [S9](#s9--appsworker-eventos-tipados) | apps/worker: Eventos Tipados | Kafka via contracts, domain logic |
| [S10](#s10--docker--cicd--observabilidade) | Docker + CI/CD + Observabilidade | Dockerfiles, compose, pipeline, limpeza |

---

## Convenções deste Documento

- **`CREATE`** — criar arquivo novo
- **`MOVE`** — mover arquivo existente para novo caminho
- **`MODIFY`** — editar arquivo existente
- **`DELETE`** — remover arquivo permanentemente
- **`RENAME`** — renomear pacote ou diretório

Critérios de aceite são **verificáveis objetivamente** (comandos, testes manuais ou checagens de import).

---

## S1 — Monorepo Scaffold + Tooling

**Objetivo:** Criar a estrutura de monorepo sem quebrar o funcionamento do projeto existente. Ao final desta sprint, o app roda exatamente como antes, mas dentro da estrutura de monorepo.

**Contexto:** Nenhuma lógica de negócio é tocada. Esta sprint é puramente estrutural e de configuração de tooling.

---

### Tarefas por pasta

#### `/` (raiz)
- `MODIFY` `package.json` — adicionar `"workspaces": ["apps/*", "packages/*", "packages/config/*"]`, instalar `turbo` como devDependency, adicionar scripts `build`, `dev`, `lint`, `typecheck`
- `CREATE` `turbo.json` — declarar tasks `build`, `dev`, `lint`, `typecheck` com `dependsOn: ["^build"]`
- `CREATE` `.gitignore` — adicionar `.turbo/` se não existir

#### `apps/web/`
- `MOVE` todo o conteúdo atual da raiz (`src/`, `public/`, `uploads/`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `vercel.json`, `entrypoint.sh`, `next-env.d.ts`) → `apps/web/`
- `CREATE` `apps/web/package.json` — com `"name": "web"` e todas as dependências do projeto atual

#### `packages/config/typescript-config/`
- `CREATE` `packages/config/typescript-config/package.json`
  ```json
  { "name": "@silo/typescript-config", "version": "1.0.0" }
  ```
- `CREATE` `packages/config/typescript-config/base.json` — tsconfig base para Node puro
- `CREATE` `packages/config/typescript-config/nextjs.json` — estende base, adiciona `jsx: preserve`, `moduleResolution: bundler`, plugin next
- `CREATE` `packages/config/typescript-config/react-library.json` — estende base, adiciona `jsx: react-jsx`

#### `packages/config/eslint-config/`
- `CREATE` `packages/config/eslint-config/package.json` — `"name": "@silo/eslint-config"`
- `CREATE` `packages/config/eslint-config/library.js` — regras base ESLint + `simple-import-sort`
- `CREATE` `packages/config/eslint-config/next.js` — estende library + `eslint-config-next`

#### `packages/config/tailwind-config/`
- `CREATE` `packages/config/tailwind-config/package.json` — `"name": "@silo/tailwind-config"`
- `CREATE` `packages/config/tailwind-config/tailwind.config.ts` — tokens de design base

#### `apps/web/` (ajuste pós-mover)
- `MODIFY` `apps/web/tsconfig.json` — estender de `@silo/typescript-config/nextjs.json`
- `MODIFY` `apps/web/eslint.config.mjs` — usar `@silo/eslint-config/next`
- `MODIFY` `apps/web/package.json` — adicionar `@silo/typescript-config` e `@silo/eslint-config` nas devDependencies

#### `apps/worker/`
- `CREATE` `apps/worker/package.json` — `"name": "worker"`, scripts `dev`, `build`, `start`, `typecheck`
- `CREATE` `apps/worker/tsconfig.json` — estender de `@silo/typescript-config/base.json`
- *(O código do worker é movido posteriormente — S9)*

---

### Critérios de Aceite — S1

- [ ] `npm install` na raiz instala todas as dependências sem erros
- [ ] `npm run dev` na raiz inicia `apps/web` e `apps/worker` via Turborepo
- [ ] `apps/web` abre no browser e funciona identicamente ao estado pré-migração
- [ ] `npm run typecheck` passa no workspace `web`
- [ ] `npm run lint` passa no workspace `web`
- [ ] Estrutura de diretórios tem `apps/`, `packages/config/` criados
- [ ] Nenhuma lógica de negócio foi alterada

---

## S2 — Pacotes de Dados e Utilitários

**Objetivo:** Extrair o banco de dados e os utilitários neutros para pacotes isolados (`packages/db`, `packages/core`), atualizando os imports no `apps/web` e `apps/worker`.

**Contexto:** Esta é a base sobre a qual todos os outros pacotes e apps vão se apoiar. Sem `@silo/db` e `@silo/core` estáveis, as sprints seguintes ficam bloqueadas.

---

### Tarefas por pasta

#### `packages/db/`
- `CREATE` `packages/db/package.json`
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
    }
  }
  ```
- `CREATE` `packages/db/tsconfig.json` — estender `@silo/typescript-config/base.json`
- `MOVE` `src/lib/db/schema/` → `packages/db/src/schema/`
- `MOVE` `src/lib/db/index.ts` (instância do Drizzle) → `packages/db/src/index.ts`
- `MOVE` `src/lib/db/migrate.ts` → `packages/db/src/migrate.ts`
- `MOVE` `src/lib/db/seed.ts` + `seedData.ts` + `seedPictures.ts` + `seedProducts.ts` + `seedRadars.ts` + `seedTypes.ts` → `packages/db/src/`
- `MOVE` `src/lib/db/reset.ts` → `packages/db/src/reset.ts`
- `MOVE` `src/lib/db/activity-status-sync.ts` → `packages/db/src/activity-status-sync.ts`
- `MOVE` `drizzle.config.ts` (raiz) → `packages/db/drizzle.config.ts`
- `MOVE` `drizzle/` (pasta de migrations) → `packages/db/drizzle/`
- `CREATE` `packages/db/.env.local` — `DATABASE_URL=...` (apenas para uso local do db:studio)

#### `packages/core/`
- `CREATE` `packages/core/package.json` com exports granulares:
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
      "./auth/hash": "./src/auth/hash.ts",
      "./auth/urls": "./src/auth/urls.ts",
      "./api-response": "./src/api-response.ts",
      "./kafka-rest": "./src/kafkaRest.ts",
      "./product-status": "./src/product-status.ts",
      "./product-activity": "./src/product-activity-history.ts",
      "./product-activity-pending-email": "./src/product-activity-pending-email.ts",
      "./task-history": "./src/task-history.ts",
      "./dataflow": "./src/dataflow/types.ts",
      "./init": "./src/init.ts"
    }
  }
  ```
  > **Nota:** api-response, kafka-rest, product-status, task-history etc. permanecem aqui **temporariamente** e serão redistribuídos nas sprints S4 e S5. Exportar agora para não quebrar os imports existentes.
- `CREATE` `packages/core/tsconfig.json`
- `MOVE` `src/lib/dateUtils.ts` → `packages/core/src/date-utils.ts`
- `MOVE` `src/lib/dateConfig.ts` → `packages/core/src/date-config.ts`
- `MOVE` `src/lib/email/` → `packages/core/src/email/`
- `MOVE` `src/lib/sendEmail.ts` → `packages/core/src/send-email.ts`
- `MOVE` `src/lib/utils.ts` → `packages/core/src/utils.ts`
- `MOVE` `src/lib/validation.ts` → `packages/core/src/validation.ts`
- `MOVE` `src/lib/markdown.ts` → `packages/core/src/markdown.ts`
- `MOVE` `src/lib/constants.ts` → `packages/core/src/constants.ts`
- `MOVE` `src/lib/config.ts` → `packages/core/src/config.ts`
- `MOVE` `src/lib/api-response.ts` → `packages/core/src/api-response.ts`
- `MOVE` `src/lib/kafkaRest.ts` → `packages/core/src/kafkaRest.ts`
- `MOVE` `src/lib/productStatus.ts` → `packages/core/src/product-status.ts`
- `MOVE` `src/lib/productActivityHistory.ts` → `packages/core/src/product-activity-history.ts`
- `MOVE` `src/lib/productActivityPendingEmail.ts` → `packages/core/src/product-activity-pending-email.ts`
- `MOVE` `src/lib/taskHistory.ts` → `packages/core/src/task-history.ts`
- `MOVE` `src/lib/init.ts` → `packages/core/src/init.ts`
- `MOVE` `src/lib/auth/hash.ts` → `packages/core/src/auth/hash.ts`
- `MOVE` `src/lib/auth/urls.ts` → `packages/core/src/auth/urls.ts`
- `MOVE` `src/lib/dataflow/` → `packages/core/src/dataflow/`

#### `apps/web/`
- `MODIFY` `apps/web/package.json` — adicionar `"@silo/db": "*"` e `"@silo/core": "*"` como dependências
- `MODIFY` todos os `route.ts` em `src/app/api/` — substituir imports de `@/lib/db` por `@silo/db`, `@/lib/db/schema` por `@silo/db/schema`
- `MODIFY` todos os arquivos em `src/lib/` que importam utilitários locais — substituir `@/lib/dateUtils` → `@silo/core/date`, `@/lib/utils` → `@silo/core/utils`, etc.
- `MODIFY` `apps/web/next.config.ts` — adicionar `transpilePackages: ["@silo/core"]`

#### `apps/worker/`
- `MODIFY` `apps/worker/package.json` — adicionar `"@silo/db": "*"` e `"@silo/core": "*"`
- `MODIFY` `apps/worker/src/index.ts` — substituir imports de `../lib/db` por `@silo/db` e utilitários por `@silo/core/*`

#### `/` (raiz)
- `MODIFY` `package.json` — adicionar scripts `db:generate`, `db:migrate`, `db:studio`, `db:seed` apontando para `-w @silo/db`

---

### Critérios de Aceite — S2

- [ ] `npm run db:migrate` executa com sucesso da raiz
- [ ] `npm run db:studio` abre o Drizzle Studio
- [ ] `npm run typecheck` passa nos workspaces `web`, `worker`, `@silo/db`, `@silo/core`
- [ ] `npm run dev` inicia o `apps/web` sem erros de import
- [ ] Nenhum arquivo em `apps/web/src/` importa diretamente de `../../db/` ou caminho relativo ao banco
- [ ] `apps/web/src/app/api/` continua funcionando (API Routes do Next.js ainda ativas)

---

## S3 — Design System e Tipos

**Objetivo:** Extrair componentes React e tipagens globais para `packages/ui` e `packages/types`, configurando o Tailwind para varrer o pacote externo.

**Contexto:** `packages/ui` depende de `@silo/core` (já criado na S2). `apps/web` para de importar de `@/components/` e passa a usar `@silo/ui`.

---

### Tarefas por pasta

#### `packages/types/`
- `CREATE` `packages/types/package.json` — `"name": "@silo/types"`, export `"." : "./src/index.ts"`
- `CREATE` `packages/types/tsconfig.json`
- `MOVE` `src/types/` → `packages/types/src/`
- `MODIFY` `packages/types/src/index.ts` — garantir que todos os tipos são re-exportados

#### `packages/ui/`
- `CREATE` `packages/ui/package.json`
  ```json
  {
    "name": "@silo/ui",
    "exports": {
      "./components/*": "./src/components/*.tsx",
      "./hooks/*": "./src/hooks/*.ts",
      "./context/*": "./src/context/*.tsx",
      "./lib/*": "./src/lib/*.ts",
      "./styles.css": "./src/globals.css"
    },
    "peerDependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" }
  }
  ```
- `CREATE` `packages/ui/tsconfig.json` — estender `@silo/typescript-config/react-library.json`
- `MOVE` `src/components/` → `packages/ui/src/components/`
- `MOVE` `src/hooks/` (apenas hooks de UI puros, sem acesso ao banco) → `packages/ui/src/hooks/`
- `MOVE` `src/context/` → `packages/ui/src/context/`
- `MOVE` `src/data/` (dados estáticos de UI) → `packages/ui/src/data/`
- `MOVE` `src/lib/` (utilitários de UI: cn, variants, etc.) → `packages/ui/src/lib/`
- `MOVE` `src/app/globals.css` → `packages/ui/src/globals.css`
- `MOVE` `src/app/apexcharts.css` + `src/app/frappe-gantt.css` → `packages/ui/src/`
- **Não mover:** hooks que importam de `@silo/db` ou fazem fetch de API — permanecem em `apps/web/src/hooks/`

#### `apps/web/`
- `MODIFY` `apps/web/package.json` — adicionar `"@silo/ui": "*"` e `"@silo/types": "*"` como dependências
- `MODIFY` `apps/web/next.config.ts` — adicionar `"@silo/ui"` e `"@silo/types"` em `transpilePackages`
- `MODIFY` `apps/web/src/app/layout.tsx` — importar CSS de `@silo/ui/styles.css`
- `MODIFY` todos os arquivos que importam de `@/components/` — substituir por `@silo/ui/components/...`
- `MODIFY` `apps/web/postcss.config.mjs` ou `tailwind.config.ts` — adicionar `"../../packages/ui/src/**/*.{js,ts,jsx,tsx}"` no `content`
- `DELETE` `apps/web/src/components/` (após confirmar que todos os imports foram migrados)
- `DELETE` `apps/web/src/app/globals.css` (agora em `@silo/ui/styles.css`)

---

### Critérios de Aceite — S3

- [ ] `npm run build -w web` compila sem erros
- [ ] UI renderiza corretamente no browser (layout, cores, componentes)
- [ ] `grep -r "from \"@/components/"` em `apps/web/src/` retorna zero resultados
- [ ] Classes Tailwind geradas por `@silo/ui` aparecem no CSS final (inspecionar elemento)
- [ ] `npm run typecheck` passa nos workspaces `@silo/ui`, `@silo/types`, `web`
- [ ] `packages/ui` não importa de `@silo/db` (verificar com `grep -r "@silo/db" packages/ui/`)

---

## S4 — Contratos e Domínio

**Objetivo:** Criar `packages/contracts` (interface pública entre os 3 runtimes) e `packages/domain` (regras de negócio puras extraídas de `@silo/core`).

**Contexto:** Esta sprint cria os fundamentos para construir a `apps/api` na próxima sprint. `@silo/contracts` define o que a API vai produzir e o que o web vai consumir. `@silo/domain` isola regras que hoje vivem misturadas em `@silo/core`.

---

### Tarefas por pasta

#### `packages/contracts/`
- `CREATE` `packages/contracts/package.json`
  ```json
  {
    "name": "@silo/contracts",
    "exports": {
      ".": "./src/index.ts",
      "./api-response": "./src/api-response.ts",
      "./auth": "./src/auth.ts",
      "./users": "./src/users.ts",
      "./groups": "./src/groups.ts",
      "./products": "./src/products.ts",
      "./projects": "./src/projects.ts",
      "./incidents": "./src/incidents.ts",
      "./tasks": "./src/tasks.ts",
      "./contacts": "./src/contacts.ts",
      "./help": "./src/help.ts",
      "./chat": "./src/chat.ts",
      "./upload": "./src/upload.ts",
      "./dataflow": "./src/dataflow.ts",
      "./kafka-events": "./src/kafka-events.ts"
    },
    "dependencies": { "zod": "*" }
  }
  ```
- `CREATE` `packages/contracts/tsconfig.json`
- `CREATE` `packages/contracts/src/api-response.ts`
  - Tipos `ApiSuccess<T>`, `ApiError`, `ApiResponse<T>`, `PaginatedResponse<T>`
  - Extraído de `packages/core/src/api-response.ts`
- `CREATE` `packages/contracts/src/kafka-events.ts`
  - `KAFKA_TOPICS` const object com todos os tópicos
  - Tipos genéricos `KafkaEvent<T, P>`
  - Tipos concretos: `ProductStatusChangedEvent`, `TaskAssignedEvent`, `TaskStatusChangedEvent`, `EmailRequestedEvent`, `IncidentCreatedEvent`
  - Union type `DomainEvent`
- `CREATE` `packages/contracts/src/dataflow.ts`
  - Extraído e adaptado de `packages/core/src/dataflow/types.ts`
- `CREATE` `packages/contracts/src/products.ts`
  - `ProductDto`, `ListProductsResponse`, `GetProductResponse`
  - `CreateProductSchema` (Zod), `UpdateProductSchema` (Zod)
  - `CreateProductRequest`, `UpdateProductRequest`
  - Sub-tipos: `ProductActivityDto`, `ProductContactDto`, `ProductProblemDto`, `ProductSolutionDto`
- `CREATE` `packages/contracts/src/projects.ts`
  - `ProjectDto`, `ListProjectsResponse`, `GetProjectResponse`
  - `CreateProjectSchema` (Zod), `UpdateProjectSchema` (Zod)
  - `ProjectGanttResponse` (para o componente gantt-task-react)
- `CREATE` `packages/contracts/src/tasks.ts`
  - `TaskDto`, `ListTasksResponse`, `CreateTaskSchema`, `UpdateTaskSchema`
- `CREATE` `packages/contracts/src/incidents.ts`
  - `IncidentDto`, `ListIncidentsResponse`, `CreateIncidentSchema`
- `CREATE` `packages/contracts/src/contacts.ts`
  - `ContactDto`, `ListContactsResponse`, `CreateContactSchema`
- `CREATE` `packages/contracts/src/help.ts`
  - `HelpArticleDto`, `ListHelpResponse`, `CreateHelpSchema`
- `CREATE` `packages/contracts/src/groups.ts`
  - `GroupDto`, `ListGroupsResponse`, `CreateGroupSchema`
  - `GroupPermissionDto`, `UpdateGroupPermissionsRequest`
- `CREATE` `packages/contracts/src/users.ts`
  - `UserDto`, `ListUsersResponse`, `UpdateUserSchema`
- `CREATE` `packages/contracts/src/chat.ts`
  - `ChatMessageDto`, `ListChatMessagesResponse`, `SendMessageSchema`
- `CREATE` `packages/contracts/src/auth.ts`
  - `SignInRequest`, `SignInResponse`, `SessionDto`
- `CREATE` `packages/contracts/src/upload.ts`
  - `UploadResponse`, categorias de upload
- `CREATE` `packages/contracts/src/index.ts` — re-exporta tudo

#### `packages/domain/`
- `CREATE` `packages/domain/package.json`
  ```json
  {
    "name": "@silo/domain",
    "exports": {
      ".": "./src/index.ts",
      "./product-status": "./src/product-status.ts",
      "./product-activity": "./src/product-activity.ts",
      "./product-pending-email": "./src/product-pending-email.ts",
      "./task-history": "./src/task-history.ts"
    },
    "dependencies": { "@silo/contracts": "*", "@silo/core": "*" }
  }
  ```
- `CREATE` `packages/domain/tsconfig.json`
- `MOVE` `packages/core/src/product-status.ts` → `packages/domain/src/product-status.ts`
- `MOVE` `packages/core/src/product-activity-history.ts` → `packages/domain/src/product-activity.ts`
- `MOVE` `packages/core/src/product-activity-pending-email.ts` → `packages/domain/src/product-pending-email.ts`
- `MOVE` `packages/core/src/task-history.ts` → `packages/domain/src/task-history.ts`
- `CREATE` `packages/domain/src/index.ts` — re-exporta todos

#### `packages/core/` (limpeza pós-extração)
- `MODIFY` `packages/core/package.json` — remover exports de `product-status`, `product-activity*`, `task-history`, `dataflow`
- `DELETE` entradas correspondentes nos exports (os arquivos foram movidos para `packages/domain`)

#### `apps/web/` (atualizar para novos pacotes)
- `MODIFY` `apps/web/package.json` — adicionar `"@silo/contracts": "*"`
- `MODIFY` `apps/web/next.config.ts` — adicionar `"@silo/contracts"` em `transpilePackages`
- `MODIFY` arquivos que importam de `@silo/core/api-response` → `@silo/contracts` (temporariamente, pois os route handlers serão removidos na S8)
- `MODIFY` arquivos que importam de `@silo/core/dataflow` → `@silo/contracts/dataflow`

#### `apps/worker/`
- `MODIFY` `apps/worker/package.json` — adicionar `"@silo/contracts": "*"` e `"@silo/domain": "*"`

---

### Critérios de Aceite — S4

- [ ] `npm run typecheck` passa nos workspaces `@silo/contracts`, `@silo/domain`, `web`, `worker`
- [ ] `packages/contracts` tem zero dependências de runtime (sem Express, React, Drizzle) — verificar `package.json`
- [ ] `packages/domain` não importa de `@silo/db` — verificar com `grep -r "@silo/db" packages/domain/`
- [ ] `packages/core` não exporta mais `product-status`, `task-history` (exports removidos)
- [ ] Todos os tipos de Kafka eventos estão em `@silo/contracts/src/kafka-events.ts` com `KAFKA_TOPICS`
- [ ] `apps/web` funciona no browser sem regressões

---

## S5 — apps/api: Scaffold + Auth + Middleware

**Objetivo:** Criar o `apps/api` com Express, migrar o `better-auth` para ele e implementar toda a pilha de middleware (auth, RBAC, rate limit, validação).

**Contexto:** Esta é a sprint mais crítica de segurança. Ao final, a autenticação deve funcionar via `apps/api`. O `apps/web` passa a usar o SDK cliente do `better-auth` apontando para `apps/api`.

---

### Tarefas por pasta

#### `apps/api/` (tudo novo)
- `CREATE` `apps/api/package.json`
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
      "@silo/contracts": "*", "@silo/db": "*",
      "@silo/domain": "*", "@silo/core": "*",
      "express": "^5.x", "better-auth": "...",
      "cors": "...", "multer": "...",
      "express-rate-limit": "...", "zod": "...",
      "dotenv": "..."
    }
  }
  ```
- `CREATE` `apps/api/tsconfig.json` — estender `@silo/typescript-config/base.json`, `"outDir": "dist"`
- `CREATE` `apps/api/.env.local` — `DATABASE_URL`, `BETTER_AUTH_SECRET`, `WEB_URL`, `KAFKA_REST_URL`, `SMTP_*`
- `CREATE` `apps/api/src/index.ts`
  - Carrega dotenv
  - Valida variáveis de ambiente (Zod)
  - Cria Express app
  - Registra middlewares globais: `cors`, `json()`, `rateLimit`
  - Registra routers (`/auth`, `/users`, `/groups`, `/products`, etc.)
  - `GET /health` → `{ status: "ok" }`
  - Inicia servidor na porta `3001`
- `CREATE` `apps/api/src/lib/db.ts` — importa e re-exporta `db` de `@silo/db`
- `CREATE` `apps/api/src/lib/kafka.ts`
  - Move lógica de `produceRecordRest` de `@silo/core/kafkaRest`
  - Exporta `publishEvent(topic: KafkaTopic, event: DomainEvent)`
- `CREATE` `apps/api/src/lib/auth.ts`
  - Move instância do `betterAuth` de `apps/web/src/lib/auth/server.ts`
  - Adapter Drizzle aponta para `@silo/db`
  - `trustedOrigins: [process.env.WEB_URL]`
- `CREATE` `apps/api/src/lib/auth-validate.ts` — move `apps/web/src/lib/auth/validate.ts`
- `CREATE` `apps/api/src/lib/auth-user-groups.ts` — move `apps/web/src/lib/auth/user-groups.ts`
- `CREATE` `apps/api/src/lib/auth-i18n.ts` — move `apps/web/src/lib/auth/i18n.ts`
- `CREATE` `apps/api/src/lib/auth-social.ts` — move `apps/web/src/lib/auth/social-utils.ts`
- `CREATE` `apps/api/src/lib/auth-rate-limits.ts` — move `apps/web/src/lib/auth/rate-limits.ts`
- `CREATE` `apps/api/src/lib/auth-urls.ts` — move `apps/web/src/lib/auth/urls.ts`
- `CREATE` `apps/api/src/routes/auth.ts` — monta `app.all("/auth/*", toNodeHandler(auth))` do better-auth
- `CREATE` `apps/api/src/middleware/auth.ts`
  - Função `requireAuth`: extrai sessão do cookie via `auth.api.getSession`
  - Retorna 401 se não autenticado
  - Injeta `req.user` com dados do usuário autenticado
- `CREATE` `apps/api/src/middleware/permissions.ts`
  - Move lógica de `apps/web/src/lib/permissions/index.ts`
  - Função `requirePermission(resource, action)` — retorna middleware Express
  - Consulta `group_permissions` via `@silo/db`
  - Retorna 403 se não autorizado
- `CREATE` `apps/api/src/middleware/rateLimit.ts`
  - Move lógica de `apps/web/src/lib/rateLimit.ts`
  - Exporta limiters por contexto (global, por usuário, por upload)
- `CREATE` `apps/api/src/middleware/validate.ts`
  - Função genérica `validate(schema)` — retorna middleware Express
  - Valida `req.body` contra schema Zod, retorna 422 com erros detalhados

#### `apps/web/` (adaptar para nova auth)
- `MODIFY` `apps/web/src/lib/auth/client.ts` — alterar `baseURL` do `createAuthClient` para `NEXT_PUBLIC_API_URL`
- `MODIFY` `apps/web/src/app/api/auth/[...all]/route.ts` — **remover** o handler local do better-auth; substituir por proxy para `apps/api/auth/*`
  ```typescript
  // apps/web/src/app/api/auth/[...all]/route.ts (proxy temporário)
  export async function GET(req: NextRequest, { params }: { params: { all: string[] } }) {
    const path = params.all.join("/")
    return fetch(`${process.env.API_URL}/auth/${path}`, {
      headers: req.headers,
      method: "GET",
    })
  }
  // mesmo para POST, PUT, DELETE
  ```
- `MODIFY` `apps/web/.env.local` — adicionar `API_URL=http://localhost:3001` e `NEXT_PUBLIC_API_URL=http://localhost:3001`
- `DELETE` `apps/web/src/lib/auth/server.ts` (instância do better-auth migrada para `apps/api`)
- `DELETE` `apps/web/src/lib/auth/validate.ts`, `user-groups.ts`, `i18n.ts`, `social-utils.ts`, `rate-limits.ts`, `urls.ts`, `admin.ts` (migrados para `apps/api`)

---

### Critérios de Aceite — S5

- [ ] `npm run dev -w api` inicia sem erros na porta 3001
- [ ] `GET http://localhost:3001/health` retorna `{ "status": "ok" }`
- [ ] Login via `apps/web` redireciona para `apps/api/auth/sign-in` e retorna cookie
- [ ] Cookie httpOnly é definido no browser após login
- [ ] `GET http://localhost:3001/users` sem cookie retorna 401
- [ ] `GET http://localhost:3001/users` com cookie válido retorna dados (mesmo que vazio por ora)
- [ ] `npm run typecheck -w api` passa sem erros
- [ ] `apps/web` consegue fazer login e logout sem regressões visíveis

---

## S6 — apps/api: Produtos, Projetos, Tarefas, Incidentes

**Objetivo:** Migrar as rotas de negócio dos 4 domínios principais do Next.js para o Express, criando a camada de Services.

**Contexto:** Cada rota migrada usa o padrão Proxy no Next.js durante a transição. Isso garante que o `apps/web` não quebra enquanto as rotas vão sendo transferidas.

**Padrão de proxy temporário** (aplicar a cada rota migrada):
```typescript
// apps/web/src/app/api/admin/products/route.ts
import { NextRequest } from "next/server"
export async function GET(req: NextRequest) {
  return fetch(`${process.env.API_URL}/products${new URL(req.url).search}`, {
    headers: { cookie: req.headers.get("cookie") ?? "" },
  })
}
export async function POST(req: NextRequest) {
  return fetch(`${process.env.API_URL}/products`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: req.headers.get("cookie") ?? "" },
    body: await req.text(),
  })
}
```

---

### Tarefas por pasta

#### `apps/api/src/services/productService.ts` (CREATE)
- Funções puras sem Express: `listProducts`, `getProductBySlug`, `createProduct`, `updateProduct`, `deleteProduct`
- Sub-recursos: `listProductActivities`, `addProductContact`, `addProductDependency`, `addProductProblem`, `addProductSolution`, `checkSolution`
- Usa `@silo/db` e `@silo/domain/product-status`, `@silo/domain/product-activity`
- Publica eventos no Kafka via `publishEvent` de `apps/api/src/lib/kafka.ts`

#### `apps/api/src/routes/products.ts` (CREATE)
- `GET /products` — lista com paginação e filtro
- `POST /products` — cria produto
- `GET /products/:slug` — busca por slug
- `PUT /products/:productId` — atualiza
- `DELETE /products/:productId` — remove
- Sub-rotas: `GET /products/:productId/activities`, `POST /products/:productId/contacts`, `POST /products/:productId/problems`, `POST /products/:productId/solutions`, `POST /products/:productId/solutions/:solutionId/check`, `POST /products/:productId/dependencies`, `POST /products/:productId/manual`
- Todas usam `requireAuth` + `requirePermission("products", ação)`
- Body validado via `validate(CreateProductSchema)`

#### `apps/api/src/services/projectService.ts` (CREATE)
- `listProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`
- `getProjectGanttData` — retorna dados no formato `ProjectGanttResponse` de `@silo/contracts`

#### `apps/api/src/routes/projects.ts` (CREATE)
- `GET /projects`, `POST /projects`, `GET /projects/:projectId`, `PUT /projects/:projectId`, `DELETE /projects/:projectId`
- `GET /projects/:projectId/gantt` — dados para o componente gantt-task-react

#### `apps/api/src/services/taskService.ts` (CREATE)
- `listTasks`, `getTask`, `createTask`, `updateTask`, `deleteTask`
- `addTaskActivity` — usa `@silo/domain/task-history`
- Publica `task.assigned` no Kafka quando tarefa é atribuída

#### `apps/api/src/routes/tasks.ts` (CREATE)
- `GET /tasks`, `POST /tasks`, `GET /tasks/:taskId`, `PUT /tasks/:taskId`, `DELETE /tasks/:taskId`

#### `apps/api/src/services/incidentService.ts` (CREATE)
- `listIncidents`, `getIncident`, `createIncident`, `updateIncident`, `deleteIncident`
- Publica `incident.created` no Kafka

#### `apps/api/src/routes/incidents.ts` (CREATE)
- `GET /incidents`, `POST /incidents`, `GET /incidents/:incidentId`, `PUT /incidents/:incidentId`, `DELETE /incidents/:incidentId`

#### `apps/web/src/app/api/admin/` (MODIFY — adicionar proxies)
- `MODIFY` `products/route.ts` → proxy para `API_URL/products`
- `MODIFY` `products/[productId]/route.ts` → proxy
- `MODIFY` `products/activities/route.ts` → proxy
- `MODIFY` `products/contacts/route.ts` → proxy
- `MODIFY` `products/problems/route.ts` → proxy
- `MODIFY` `products/solutions/route.ts` → proxy
- `MODIFY` `projects/route.ts` → proxy
- `MODIFY` `projects/[projectId]/route.ts` → proxy
- `MODIFY` `tasks/route.ts` → proxy (se existir) → proxy
- `MODIFY` `incidents/route.ts` → proxy (se existir) → proxy

---

### Critérios de Aceite — S6

- [ ] `GET http://localhost:3001/products` com auth retorna lista de produtos
- [ ] `POST http://localhost:3001/products` cria produto e retorna 201
- [ ] `GET http://localhost:3001/projects` retorna lista de projetos
- [ ] `GET http://localhost:3001/projects/:id/gantt` retorna dados no formato correto
- [ ] Painel de produtos em `apps/web` continua funcionando via proxy
- [ ] Painel de projetos em `apps/web` continua funcionando via proxy
- [ ] `npm run typecheck -w api` sem erros
- [ ] Services são funções puras: nenhum `Request` ou `Response` do Express nos parâmetros

---

## S7 — apps/api: Contatos, Ajuda, Chat, Dashboard, Reports, Monitoring, Upload

**Objetivo:** Completar a `apps/api` com todos os domínios restantes. Ao final desta sprint, 100% das rotas de negócio existem em `apps/api`.

---

### Tarefas por pasta

#### `apps/api/src/services/` (tudo CREATE)

- `contactService.ts` — `listContacts`, `getContact`, `createContact`, `updateContact`, `deleteContact`
- `helpService.ts` — `listArticles`, `getArticle`, `createArticle`, `updateArticle`, `deleteArticle`
- `chatService.ts` — `listMessages`, `sendMessage`, `listChannels`
- `dashboardService.ts` — queries agregadas: contagem de produtos por status, incidentes recentes, tarefas atrasadas, atividade recente
- `reportService.ts` — geração de dados para relatórios
- `monitoringService.ts` — métricas de saúde de sistemas
- `userService.ts` — `listUsers`, `getUser`, `updateUser`, `deactivateUser`, `getUserGroups`
- `groupService.ts` — `listGroups`, `createGroup`, `updateGroup`, `deleteGroup`, `setGroupPermissions`

#### `apps/api/src/routes/` (tudo CREATE)

- `contacts.ts` — CRUD `/contacts`
- `help.ts` — CRUD `/help`
- `chat.ts` — `/chat/messages`, `/chat/channels`
- `dashboard.ts` — `GET /dashboard` (dados agregados)
- `reports.ts` — `GET /reports/:type`
- `monitoring.ts` — `GET /monitoring`
- `users.ts` — `/users`, `/users/:userId`, `/users/:userId/groups`
- `groups.ts` — `/groups`, `/groups/:groupId`, `/groups/:groupId/permissions`

#### `apps/api/src/routes/upload.ts` (CREATE)
- `POST /upload/:category` — recebe arquivo via multer
- Categorias: `avatars`, `contacts`, `general`, `help`, `incidents`, `projects`, `products`, `manual`
- Retorna URL pública do arquivo no formato `{ url: "/uploads/:category/:filename" }`

#### `apps/api/src/lib/uploads.ts` (CREATE)
- Move lógica de `apps/web/src/lib/localUploads.ts` e `apps/web/src/lib/profileImage.ts`
- Configura multer com destino `apps/api/uploads/`
- Exporta `setupUploadsDir()` para criar diretórios na inicialização

#### `apps/api/src/index.ts` (MODIFY)
- Registrar todos os novos routers
- Servir arquivos estáticos: `express.static("uploads")` em `/uploads`
- Chamar `setupUploadsDir()` no bootstrap

#### `apps/api/uploads/` (CREATE)
- Criar subdiretórios: `avatars/`, `contacts/`, `general/`, `help/`, `incidents/`, `manual/`, `products/`, `projects/`

#### `apps/web/src/app/api/admin/` (MODIFY — adicionar proxies restantes)
- `MODIFY` `contacts/route.ts` → proxy
- `MODIFY` `help/route.ts` → proxy
- `MODIFY` `chat/route.ts` → proxy
- `MODIFY` `dashboard/route.ts` → proxy
- `MODIFY` `reports/route.ts` → proxy
- `MODIFY` `monitoring/route.ts` → proxy
- `MODIFY` `users/route.ts` → proxy
- `MODIFY` `groups/route.ts` → proxy
- `MODIFY` `upload/route.ts` → proxy para `API_URL/upload/:category`

---

### Critérios de Aceite — S7

- [ ] `GET http://localhost:3001/dashboard` retorna dados agregados
- [ ] `GET http://localhost:3001/groups` retorna lista de grupos com permissões
- [ ] `POST http://localhost:3001/upload/avatars` com multipart retorna URL do arquivo
- [ ] Arquivo é salvo em `apps/api/uploads/avatars/`
- [ ] Painel administrativo em `apps/web` funciona completamente via proxies
- [ ] Nenhuma rota admin em `apps/web/src/app/api/admin/` tem lógica própria — todas são proxies
- [ ] `npm run typecheck -w api` sem erros
- [ ] `apps/api` tem ao menos `GET /health` + todas as rotas de domínio respondendo

---

## S8 — apps/web: Consome a API

**Objetivo:** Remover todo acesso direto ao banco do `apps/web`. Substituir chamadas internas (`fetch("/api/admin/...")`) por chamadas tipadas ao `apps/api` via `api-client.ts`. Deletar os proxies e os route handlers.

**Contexto:** Esta é a sprint de maior impacto no frontend. Ao final, `apps/web` não tem `DATABASE_URL`, não importa `@silo/db`, e não tem lógica de backend.

---

### Tarefas por pasta

#### `apps/web/src/lib/api-client.ts` (CREATE)
```typescript
// apps/web/src/lib/api-client.ts
import type { ApiResponse } from "@silo/contracts"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
  })
  return res.json() as Promise<ApiResponse<T>>
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}
```

#### `apps/web/src/app/admin/` (MODIFY — páginas e Server Components)
- Para cada página em `admin/`, substituir `fetch("/api/admin/...")` por `apiClient.get<TipoContrato>("...")` usando o tipo correto de `@silo/contracts`
- Remover imports de `@silo/database`, `@silo/core/api-response`, `@silo/core/product-status` etc.
- Páginas que fazem Server Actions com queries diretas ao banco → converter para `apiClient.post()`

Páginas a migrar:
- `admin/products/` — usa `apiClient.get<ListProductsResponse>("/products")`
- `admin/projects/` — usa `apiClient.get<ListProjectsResponse>("/projects")`
- `admin/tasks/` — usa `apiClient.get<ListTasksResponse>("/tasks")`
- `admin/incidents/` — usa `apiClient.get<ListIncidentsResponse>("/incidents")`
- `admin/contacts/` — usa `apiClient.get<ListContactsResponse>("/contacts")`
- `admin/help/` — usa `apiClient.get<ListHelpResponse>("/help")`
- `admin/chat/` — usa `apiClient.get<ListChatMessagesResponse>("/chat/messages")`
- `admin/dashboard/` — usa `apiClient.get<DashboardResponse>("/dashboard")`
- `admin/groups/` — usa `apiClient.get<ListGroupsResponse>("/groups")`
- `admin/settings/` — usa `apiClient.get<UserDto>("/users/me")`

#### `apps/web/src/app/api/admin/` (DELETE)
- `DELETE` toda a pasta `apps/web/src/app/api/admin/` (proxies já cumpriram sua função)

#### `apps/web/src/app/api/upload/` (DELETE)
- `DELETE` `apps/web/src/app/api/upload/` — upload agora é feito diretamente para `API_URL/upload`

#### `apps/web/src/lib/` (limpeza)
- `DELETE` `apps/web/src/lib/localUploads.ts` (migrado para `apps/api`)
- `DELETE` `apps/web/src/lib/profileImage.ts` (migrado para `apps/api`)
- `DELETE` `apps/web/src/lib/rateLimit.ts` (migrado para `apps/api`)
- `DELETE` `apps/web/src/lib/dataflow/kafkaDataFlowSource.ts` (ou migrar para usar `@silo/contracts/dataflow` e `apiClient` se a visualização de dataflow for mantida)
- `DELETE` `apps/web/src/lib/permissions/index.ts` (RBAC agora é responsabilidade da API)

#### `apps/web/package.json` (MODIFY)
- `DELETE` `"@silo/database"` das dependências
- Verificar que `"@silo/db"` também não está presente
- Manter: `"@silo/contracts"`, `"@silo/ui"`, `"@silo/core"`, `"@silo/types"`

#### `apps/web/.env.local` (MODIFY)
- `DELETE` `DATABASE_URL` do arquivo `.env.local` do web
- `DELETE` `BETTER_AUTH_SECRET` do arquivo `.env.local` do web
- Manter: `NEXT_PUBLIC_API_URL`, `API_URL`

---

### Critérios de Aceite — S8

- [ ] `grep -r "@silo/database\|@silo/db" apps/web/` retorna zero resultados
- [ ] `grep -r "from \"@/lib/permissions\"" apps/web/src/` retorna zero resultados
- [ ] `grep -r "from \"@/lib/auth/server\"" apps/web/src/` retorna zero resultados
- [ ] `apps/web/src/app/api/admin/` não existe
- [ ] `apps/web/src/app/api/upload/` não existe
- [ ] `npm run build -w web` passa sem erros
- [ ] Painel administrativo funciona completamente no browser (login, listagens, CRUD)
- [ ] Upload de arquivo funciona (avatar, imagem de produto) chamando `apps/api` diretamente
- [ ] `apps/web` inicia sem `DATABASE_URL` no ambiente (testar removendo a variável)

---

## S9 — apps/worker: Eventos Tipados

**Objetivo:** Atualizar o `apps/worker` para usar `@silo/contracts` para tipagem dos eventos Kafka, mover a lógica do Kafka REST client de `@silo/core` para o worker, e integrar `@silo/domain` nos handlers.

**Contexto:** O worker atual já funciona com `@silo/core/kafka-rest`. Esta sprint apenas tipa corretamente os eventos e limpa as dependências.

---

### Tarefas por pasta

#### `apps/worker/src/lib/kafka.ts` (CREATE)
- Move funções do Kafka REST de `@silo/core/kafka-rest` para arquivo local
- Expõe: `createRestConsumer`, `fetchRecordsRest`, `commitOffsetsRest`, `subscribeRest`, `deleteRestConsumer`
- Não é mais importado de `@silo/core`

#### `apps/worker/src/lib/topicHandlers.ts` (MODIFY)
- Importar `KAFKA_TOPICS` de `@silo/contracts`
- Tipar o retorno de `getHandlerForTopic` com os tipos corretos de `DomainEvent`

#### `apps/worker/src/lib/handlers/modelHandler.ts` (MODIFY)
- Adicionar tipagem com tipos de `@silo/contracts/kafka-events`
- Importar lógica de domínio de `@silo/domain` onde aplicável
- Ex: ao processar mudança de status, usar `@silo/domain/product-status` para validar transição

#### `apps/worker/src/lib/handlers/monitoringHandler.ts` (MODIFY)
- Adicionar tipagem com `@silo/contracts`

#### `apps/worker/src/index.ts` (MODIFY)
- Importar `KAFKA_TOPICS` de `@silo/contracts` para os tópicos que o worker assina
- Substituir strings hardcoded de tópico por `KAFKA_TOPICS.*`
- Substituir import de `@silo/core/kafka-rest` por import local `./lib/kafka`

#### `packages/core/` (limpeza final)
- `DELETE` `packages/core/src/kafkaRest.ts` — já foi movido para `apps/api/src/lib/kafka.ts` e `apps/worker/src/lib/kafka.ts`
- `DELETE` `packages/core/src/api-response.ts` — já está em `packages/contracts/src/api-response.ts`
- `DELETE` `packages/core/src/init.ts` — cada app faz seu próprio bootstrap
- `MODIFY` `packages/core/package.json` — remover exports de `kafka-rest`, `api-response`, `init`

#### `apps/api/src/lib/kafka.ts` (MODIFY)
- Garantir que usa `KAFKA_TOPICS` de `@silo/contracts` em vez de strings hardcoded
- Tipar o parâmetro `event` do `publishEvent` como `DomainEvent` de `@silo/contracts`

---

### Critérios de Aceite — S9

- [ ] `grep -r "@silo/core/kafka-rest" apps/worker/` retorna zero resultados
- [ ] `grep -r "@silo/core/kafka-rest" apps/api/` retorna zero resultados
- [ ] `grep -r "kafkaRest" packages/core/src/` retorna zero resultados (arquivo deletado)
- [ ] `KAFKA_TOPICS` é importado de `@silo/contracts` em `apps/worker` e `apps/api`
- [ ] `npm run typecheck -w worker` passa sem erros
- [ ] Worker inicia e processa mensagens normalmente em desenvolvimento
- [ ] Handlers tipam os eventos recebidos com tipos de `@silo/contracts`
- [ ] `packages/core` não exporta mais `kafka-rest`, `api-response`, `init`

---

## S10 — Docker + CI/CD + Observabilidade

**Objetivo:** Tornar o projeto pronto para produção com Dockerfiles isolados para cada runtime, `docker-compose.yml` completo, pipeline de CI/CD configurado e segregação final de variáveis de ambiente.

**Contexto:** Última sprint. Focada em operações, não em código de aplicação.

---

### Tarefas por pasta

#### `apps/web/Dockerfile` (CREATE)
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

- `MODIFY` `apps/web/next.config.ts` — adicionar `output: "standalone"`

#### `apps/api/Dockerfile` (CREATE)
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
RUN mkdir -p uploads/avatars uploads/contacts uploads/general uploads/help \
    uploads/incidents uploads/manual uploads/products uploads/projects
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

#### `apps/worker/Dockerfile` (CREATE)
- Idêntico ao da API, substituindo `api` por `worker`
- Sem `EXPOSE` (sem porta HTTP)

#### `docker-compose.yml` (CREATE — raiz)
```yaml
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

  kafka-rest:
    image: confluentinc/cp-kafka-rest:latest
    ports: ["8082:8082"]
    environment:
      KAFKA_REST_BOOTSTRAP_SERVERS: kafka:9092
      KAFKA_REST_HOST_NAME: kafka-rest
    depends_on: [kafka]

  kafka:
    image: confluentinc/cp-kafka:latest
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
    depends_on: [zookeeper]

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  api:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    ports: ["3001:3001"]
    environment:
      DATABASE_URL: postgresql://silo:silo@postgres:5432/silo
      KAFKA_REST_URL: http://kafka-rest:8082
      WEB_URL: http://web:3000
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      SMTP_HOST: ${SMTP_HOST}
    volumes:
      - uploads_data:/app/uploads
    depends_on: [postgres, kafka-rest]

  worker:
    build: { context: ., dockerfile: apps/worker/Dockerfile }
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://silo:silo@postgres:5432/silo
      KAFKA_REST_URL: http://kafka-rest:8082
    depends_on: [kafka-rest, postgres]

  web:
    build: { context: ., dockerfile: apps/web/Dockerfile }
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://api:3001
      API_URL: http://api:3001
    depends_on: [api]

volumes:
  postgres_data:
  uploads_data:
```

#### `.github/workflows/ci.yml` (CREATE)
```yaml
name: CI
on:
  push: { branches: ["main"] }
  pull_request: { types: [opened, synchronize] }

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 2 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx turbo run typecheck lint build
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

#### `.env.example` (CREATE — raiz)
- Documento de referência com **todas** as variáveis do sistema, separadas por seção (`# apps/api`, `# apps/web`, `# apps/worker`, `# packages/db`)
- Nenhum valor real, apenas chaves e descrições

#### Variáveis de ambiente — segregação final
- `CREATE` `apps/web/.env.local` — apenas `NEXT_PUBLIC_API_URL`, `API_URL`
- `CREATE` `apps/api/.env.local` — `DATABASE_URL`, `BETTER_AUTH_SECRET`, `KAFKA_REST_URL`, `WEB_URL`, `SMTP_*`, `UPLOAD_DIR`
- `CREATE` `apps/worker/.env.local` — `DATABASE_URL`, `KAFKA_REST_URL`
- `CREATE` `packages/db/.env.local` — `DATABASE_URL` (apenas para db:studio local)

#### Limpeza final (raiz)
- `DELETE` `PLAN-MONOREPO.md` (substituído por `PLAN-UPGRADE.md`)
- `DELETE` `PLAN-REFACTOR.md` (substituído por `PLAN-UPGRADE.md`)
- `MODIFY` `README.md` — atualizar com nova estrutura, comandos de dev, arquitetura

#### Auditoria final de imports (executar antes de fechar a sprint)
```bash
# Nenhum import de banco no web
grep -r "@silo/db\|@silo/database\|drizzle" apps/web/src/

# Nenhum Kafka no web
grep -r "kafka" apps/web/src/

# Nenhuma lógica Express no web
grep -r "express\|Request.*Response" apps/web/src/

# Nenhum import interno do web nos pacotes
grep -r "apps/web" packages/

# KAFKA_TOPICS não é hardcoded
grep -rE "\"(product\.|task\.|incident\.|email\.)" apps/api/src/ apps/worker/src/
```

---

### Critérios de Aceite — S10

- [ ] `docker compose up --build` inicia todos os serviços sem erros
- [ ] `docker compose ps` mostra `web`, `api`, `worker`, `postgres`, `kafka`, `kafka-rest`, `zookeeper` como `Up`
- [ ] `curl http://localhost:3000` retorna a página de login
- [ ] `curl http://localhost:3001/health` retorna `{ "status": "ok" }`
- [ ] Login funciona no browser com Docker
- [ ] Worker aparece em `docker logs silo-worker` processando mensagens
- [ ] CI pipeline passa no GitHub Actions com `typecheck + lint + build`
- [ ] `apps/web` inicia com sucesso sem `DATABASE_URL` no ambiente
- [ ] `docker compose down && docker compose up` recria corretamente (volumes persistentes)
- [ ] `.env.example` documenta todas as variáveis necessárias por app

---

## Resumo Visual das Sprints

```
S1   Scaffold        ████░░░░░░░░░░░░░░░░░░░░░░░░░░
S2   packages/db     ████████░░░░░░░░░░░░░░░░░░░░░░
     + core
S3   packages/ui     ████████████░░░░░░░░░░░░░░░░░░
     + types
S4   contracts       ████████████████░░░░░░░░░░░░░░
     + domain
S5   api: auth       ████████████████████░░░░░░░░░░
S6   api: produtos   ████████████████████████░░░░░░
     projetos tarefas
     incidentes
S7   api: restantes  ████████████████████████████░░
S8   web: consome    ░░░░░░░░████████████████████░░░
     a api
S9   worker          ░░░░░░░░░░░░░░░░████████████░░
     contracts
S10  Docker CI/CD    ░░░░░░░░░░░░░░░░░░░░░░░░░░████
```

```
DEPENDÊNCIAS ENTRE SPRINTS:

S1 ──► S2 ──► S3 ──► S4 ──► S5 ──► S6 ──► S7 ──► S10
                      │              │
                      └──────────────┴──► S8 ──► S10
                                    │
                                    └──► S9 ──► S10
```

S8 depende de S7 estar completa (todos os endpoints em `apps/api`).
S9 pode rodar em paralelo com S8 se houver pessoas disponíveis.
S10 só começa quando S8 e S9 estão completas.

---

## Checklist de Fronteiras — Validação Final

Execute antes de fechar S10:

```bash
# apps/web não acessa banco
grep -rn "from \"@silo/db\"\|from \"@silo/database\"\|drizzle-orm" apps/web/src/
# esperado: zero resultados

# apps/web não tem lógica de hash
grep -rn "bcrypt\|hashPassword" apps/web/src/
# esperado: zero resultados

# apps/web não tem servidor better-auth
grep -rn "betterAuth\|from \"better-auth\"" apps/web/src/
# esperado: apenas client.ts

# packages/contracts sem dependência de runtime
cat packages/contracts/package.json | grep -E "express|next|react|drizzle"
# esperado: zero resultados

# packages/domain sem dependência de I/O
cat packages/domain/package.json | grep -E "pg|express|next|kafkajs"
# esperado: zero resultados

# KAFKA_TOPICS usados de contracts
grep -rn "KAFKA_TOPICS" apps/api/src/ apps/worker/src/
# esperado: importa de @silo/contracts

# Todos os typecheck passam
npx turbo run typecheck
# esperado: zero errors em todos os workspaces
```
