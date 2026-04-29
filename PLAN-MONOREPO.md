# Plano Diretor de Migração para Monorepo (Silo)

Este documento estabelece o planejamento arquitetural, estrutural e técnico para a migração do projeto "Silo" de uma estrutura monolítica (onde tudo coexiste no mesmo diretório base) para um **Monorepo** moderno utilizando **Turborepo** e **npm workspaces**. 

O objetivo primário desta arquitetura é garantir isolamento de responsabilidades, independência de deployment, compartilhamento de código tipado e escalabilidade estrutural para suportar novas aplicações e serviços (ex: APIs REST isoladas, painéis de admin) no futuro.

---

## 1. Visão Geral e Justificativa

### 1.1 O Cenário Atual
Atualmente, o repositório contém uma aplicação **Next.js** acoplada a:
- Scripts de background (consumer do Kafka).
- Domínio de banco de dados (Drizzle ORM, schemas, migrations).
- Lógicas de negócio genéricas (envios de email, formatações de data).
- Sistema de design e componentes de UI.

**Desafios do modelo atual:**
- **Acoplamento:** O consumer do Kafka compartilha dependências com o frontend (ex: React, Tailwind), o que infla o tamanho do build e mistura responsabilidades.
- **Dificuldade de Escalabilidade Horizontal:** Para escalar apenas o consumidor de filas, é necessário escalar toda a aplicação Next.js junto (ou criar entrypoints complexos via Dockerfile).
- **Tempo de Build:** Qualquer alteração no banco de dados exige um rebuild total da interface web, e vice-versa.

### 1.2 O Cenário Proposto (Monorepo)
A arquitetura proposta extrai as camadas de domínio, UI, configurações e regras de negócio para **pacotes independentes**, consumidos por **aplicações independentes**.

**Benefícios Imediatos:**
- **Fronteiras Claras:** Códigos do backend (Kafka/Worker) nunca poderão importar, por acidente, código React.
- **Deploy Isolado:** Imagens Docker minúsculas focadas apenas no que cada aplicação precisa.
- **Builds em Cache:** O Turborepo garante que pacotes inalterados usem cache de build, reduzindo pipelines de CI/CD de minutos para segundos.
- **Fonte Única da Verdade:** O banco de dados e os tipos serão consumidos internamente através de aliases de pacote (ex: `@silo/database`), garantindo contratos estritos em TypeScript.

---

## 2. Arquitetura Estrutural Alvo

A transição utilizará `npm` (versão 7+ com a funcionalidade nativa de workspaces) e `Turborepo` (para orquestração de scripts). A raiz do projeto gerenciará apenas as configurações globais e o vínculo entre os pacotes.

```text
silo-sessojunior/
├── .husky/                       # Hooks do Git
├── .github/                      # Workflows de CI/CD ou .gitlab-ci.yml
├── apps/                         # Aplicações executáveis
│   ├── web/                      # [Next.js App Router] Aplicação principal
│   │   ├── src/                  # Componentes de página, rotas, hooks
│   │   ├── public/               # Assets estáticos
│   │   ├── next.config.ts        
│   │   ├── tsconfig.json         # Estende de @silo/typescript-config/nextjs.json
│   │   └── package.json          # Depende de: @silo/ui, @silo/database, @silo/core
│   │
│   └── worker/                   # [Node.js Worker] Consumer do Kafka
│       ├── src/                  # Lógica de consumo de tópicos
│       ├── tsconfig.json         # Estende de @silo/typescript-config/base.json
│       ├── Dockerfile            # Dockerfile isolado
│       └── package.json          # Depende de: @silo/database, @silo/core
│
├── packages/                     # Bibliotecas compartilhadas e isoladas
│   ├── database/                 # [Drizzle ORM] Banco de Dados
│   │   ├── src/                  # Schemas, conexão, migrations
│   │   ├── drizzle.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── ui/                       # [React/Tailwind] Design System
│   │   ├── src/                  # Radix UI, Componentes isolados, Hooks de UI
│   │   ├── tailwind.config.ts    
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── core/                     # [TypeScript] Lógicas de negócio comuns
│   │   ├── src/                  # Utilitários de data, e-mails, integrações base
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── types/                    # [TypeScript] Tipagens globais do sistema
│   │   ├── src/                  
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── config/                   # Configurações de tooling (ESLint, TS, etc)
│       ├── eslint-config/        # Regras de lint centralizadas
│       │   ├── next.js           # Regras específicas para Next.js
│       │   ├── library.js        # Regras para pacotes genéricos
│       │   └── package.json
│       ├── typescript-config/    # Arquivos tsconfig.base.json
│       │   ├── base.json         # Node puro
│       │   ├── nextjs.json       # Config para o web
│       │   ├── react-library.json# Config para o UI
│       │   └── package.json
│       └── tailwind-config/      # Tokens e temas do Tailwind
│           ├── tailwind.config.ts
│           └── package.json
│
├── docker-compose.yml            # Orquestração local multisserviço
├── package.json                  # Root package.json (gerencia dependências globais e define workspaces)
└── turbo.json                    # Declaração do grafo de tarefas do Turborepo
```

---

## 3. Especificação Detalhada dos Pacotes (Packages)

Cada diretório dentro de `packages/` funcionará como um pacote npm interno. Eles não serão publicados no npmjs.com, mas serão instalados (linkados) nas aplicações através do npm workspaces, usando `"*"` como versão no `package.json` (o npm resolve automaticamente via symlinks na `node_modules` da raiz).

### 3.1. Pacotes de Configuração (`packages/config/*`)

A abstração de configuração é vital para que não precisemos copiar e colar regras de TypeScript ou ESLint em todos os diretórios.

#### 3.1.1 `@silo/eslint-config`
Centraliza as regras de lint do projeto para garantir padronização em todos os apps e pacotes.

**Estrutura:**
`packages/config/eslint-config/package.json`
```json
{
  "name": "@silo/eslint-config",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "eslint": "^9.39.2",
    "eslint-config-next": "^16.1.6",
    "eslint-plugin-simple-import-sort": "^12.1.1"
  }
}
```

O arquivo `packages/config/eslint-config/library.js`:
```javascript
/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["eslint:recommended"],
  plugins: ["simple-import-sort"],
  rules: {
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
  },
  env: {
    node: true,
  },
};
```

O arquivo `packages/config/eslint-config/next.js`:
```javascript
/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["./library.js", "next/core-web-vitals"],
  rules: {
    "@next/next/no-html-link-for-pages": "error",
  },
};
```

#### 3.1.2 `@silo/typescript-config`
Garante a mesma rigidez de tipagem para todo o ecossistema.

**Estrutura:**
`packages/config/typescript-config/package.json`
```json
{
  "name": "@silo/typescript-config",
  "version": "1.0.0",
  "publishConfig": {
    "access": "public"
  }
}
```

`packages/config/typescript-config/base.json`:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Default",
  "compilerOptions": {
    "composite": false,
    "declaration": true,
    "declarationMap": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "inlineSources": false,
    "isolatedModules": true,
    "moduleResolution": "node",
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "preserveWatchOutput": true,
    "skipLibCheck": true,
    "strict": true
  },
  "exclude": ["node_modules"]
}
```

`packages/config/typescript-config/react-library.json`:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "React Library",
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "target": "ESNext",
    "lib": ["DOM", "DOM.Iterable", "ESNext"]
  }
}
```

`packages/config/typescript-config/nextjs.json`:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Next.js",
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ESNext",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": true,
    "plugins": [{ "name": "next" }]
  }
}
```

#### 3.1.3 `@silo/tailwind-config`
Armazena a base dos tokens de design, garantindo que se você adicionar uma cor primária nova, o app e a biblioteca de UI herdarão essa cor simultaneamente.

`packages/config/tailwind-config/package.json`:
```json
{
  "name": "@silo/tailwind-config",
  "version": "1.0.0",
  "exports": {
    ".": "./tailwind.config.ts"
  },
  "dependencies": {
    "@tailwindcss/forms": "^0.5.11",
    "@tailwindcss/typography": "^0.5.19"
  }
}
```

---

### 3.2. Pacote de Tipagens (`packages/types`)
- **Nome do pacote:** `@silo/types`
- **Objetivo:** Armazenar tipos e interfaces TypeScript que não dependem de lógica de banco de dados, mas sim do negócio em si (ex: Enums de domínio, Tipos de eventos Kafka, DTOs genéricos).
- **Conteúdo atual que será movido:** Conteúdo de `src/types/`.

**package.json de `@silo/types`:**
```json
{
  "name": "@silo/types",
  "version": "1.0.0",
  "exports": {
    ".": "./src/index.ts"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "@silo/typescript-config": "*"
  }
}
```

**tsconfig.json de `@silo/types`:**
```json
{
  "extends": "@silo/typescript-config/base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

### 3.3. Pacote Principal de Regras (`packages/core`)
- **Nome do pacote:** `@silo/core`
- **Objetivo:** Isolar utilitários, wrappers HTTP, integrações terceiras (como envio de e-mails, validações Zod genéricas, manipulações de data usando `date-fns` e `date-fns-tz`), e regras de negócio reutilizáveis entre `web` e `worker`.
- **O que será movido** (renomeando para kebab-case):

| Arquivo original (`src/lib/`) | Destino em `packages/core/src/` |
|---|---|
| `dateUtils.ts` | `date-utils.ts` |
| `dateConfig.ts` | `date-config.ts` |
| `email/` | `email/` |
| `sendEmail.ts` | `send-email.ts` |
| `utils.ts` | `utils.ts` |
| `validation.ts` | `validation.ts` |
| `markdown.ts` | `markdown.ts` |
| `constants.ts` | `constants.ts` |
| `productStatus.ts` | `product-status.ts` |
| `productActivityHistory.ts` | `product-activity-history.ts` |
| `productActivityPendingEmail.ts` | `product-activity-pending-email.ts` |
| `taskHistory.ts` | `task-history.ts` |
| `api-response.ts` | `api-response.ts` |

**Estrutura do exports:**
```json
{
  "name": "@silo/core",
  "version": "1.0.0",
  "exports": {
    "./date": "./src/date-utils.ts",
    "./date-config": "./src/date-config.ts",
    "./email": "./src/email/index.ts",
    "./send-email": "./src/send-email.ts",
    "./utils": "./src/utils.ts",
    "./validation": "./src/validation.ts",
    "./markdown": "./src/markdown.ts",
    "./constants": "./src/constants.ts",
    "./product-status": "./src/product-status.ts",
    "./product-activity": "./src/product-activity-history.ts",
    "./task-history": "./src/task-history.ts",
    "./api-response": "./src/api-response.ts"
  },
  "dependencies": {
    "date-fns": "^4.1.0",
    "date-fns-tz": "^3.2.0",
    "nodemailer": "^8.0.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@silo/typescript-config": "*"
  }
}
```
Isso permite imports finos: `import { formatTimezone } from '@silo/core/date'`.

---

### 3.4. Pacote de Banco de Dados (`packages/database`)
- **Nome do pacote:** `@silo/database`
- **Objetivo:** Fonte única da verdade sobre o banco. O Drizzle ORM ficará isolado aqui. Migrations rodarão a partir deste diretório.
- **O que será movido:** `src/lib/db/`, `drizzle.config.ts`, `drizzle/` (pasta de migrations).

**package.json de `@silo/database`:**
```json
{
  "name": "@silo/database",
  "version": "1.0.0",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:migrate": "tsx src/migrate.ts",
    "db:seed": "tsx src/seed.ts",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "^0.45.1",
    "pg": "^8.18.0",
    "@silo/types": "*"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.8",
    "tsx": "^4.21.0",
    "@silo/typescript-config": "*"
  }
}
```
**Integração:** Tanto a Web API quanto o Consumer criarão instâncias de seus serviços baseados no objeto `db` importado de `@silo/database`.

---

### 3.5. Pacote de UI (`packages/ui`)
- **Nome do pacote:** `@silo/ui`
- **Objetivo:** O Design System da Silo. Armazena apenas componentes burros (Dumb Components) e de visualização. Não faz fetch, não acessa banco. Componentes compostos como botões, modais, gráficos básicos, e ícones.
- **O que será movido:** Arquivos em `src/components/`, `src/hooks/` (hooks de UI puros).

**package.json de `@silo/ui`:**
```json
{
  "name": "@silo/ui",
  "version": "1.0.0",
  "exports": {
    "./components/*": "./src/components/*.tsx",
    "./hooks/*": "./src/hooks/*.ts",
    "./styles.css": "./src/globals.css"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "classnames": "^2.5.1",
    "clsx": "^2.1.1",
    "lucide-react": "latest",
    "tailwind-merge": "^3.4.0",
    "react-apexcharts": "^1.9.0"
  },
  "devDependencies": {
    "@silo/typescript-config": "*",
    "@silo/tailwind-config": "*"
  },
  "peerDependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

---

### 3.6. Arquivos que Permanecem em `apps/web`

Os seguintes arquivos de `src/lib/` são específicos da aplicação Next.js e **não** serão extraídos para pacotes compartilhados:

| Arquivo original (`src/lib/`) | Motivo para permanecer em `apps/web` |
|---|---|
| `auth/` | Configuração do `better-auth` — acoplado ao Next.js |
| `config.ts` | Variáveis de ambiente específicas do web |
| `init.ts` | Inicialização de serviços do app web |
| `kafkaRest.ts` | Cliente REST do Kafka — publicação de eventos via API, específico do web |
| `localUploads.ts` | Gerenciamento de upload de arquivos no servidor Next.js |
| `profileImage.ts` | Processamento de imagem de perfil — específico do web |
| `rateLimit.ts` | Rate limiting nas API Routes do Next.js |
| `theme.ts` | Tema da UI — permanece em `apps/web` ou migra para `@silo/ui` |
| `toast.ts` | Configuração de notificações toast — específico do web |
| `dataflow/` | Lógica de visualização de fluxo de dados — específico do web |
| `navigation/` | Helpers de navegação Next.js |
| `permissions/` | Lógica de autorização vinculada ao contexto de sessão do web |

---

### 3.7. Arquivos da Raiz e Assets

Os arquivos presentes atualmente na raiz do projeto monolítico seguem o seguinte destino:

| Arquivo/Pasta atual | Destino no Monorepo |
|---|---|
| `src/` | `apps/web/src/` (após extração dos pacotes) |
| `src/proxy.ts` | `apps/web/src/proxy.ts` |
| `src/scripts/kafka/consumer.ts` | `apps/worker/src/index.ts` (renomeado) |
| `public/` | `apps/web/public/` |
| `uploads/` | `apps/web/uploads/` (volume Docker mapeado) |
| `next.config.ts` | `apps/web/next.config.ts` |
| `tsconfig.json` | `apps/web/tsconfig.json` (estende `@silo/typescript-config/nextjs.json`) |
| `drizzle.config.ts` | `packages/database/drizzle.config.ts` |
| `drizzle/` | `packages/database/drizzle/` |
| `vercel.json` | `apps/web/vercel.json` |
| `entrypoint.sh` | `apps/web/entrypoint.sh` |
| `deploy.js` | `scripts/deploy.js` (raiz do monorepo) |
| `scripts/gitlab/` | `scripts/gitlab/` (raiz do monorepo) |
| `docker-compose.kafka.yml` | Raiz do monorepo (sem alteração) |
| `docker-compose.deploy.yml` | Raiz do monorepo (sem alteração) |
| `eslint.config.mjs` | `apps/web/eslint.config.mjs` (ou substituído por `@silo/eslint-config`) |
| `postcss.config.mjs` | `apps/web/postcss.config.mjs` |
| `env.example` | Raiz do monorepo — serve como referência global |

**Estratégia de Variáveis de Ambiente:**
No monorepo, a abordagem mais simples é manter um único arquivo `.env` na raiz. Cada aplicação lerá as variáveis que precisa. O Docker Compose passará as variáveis via `env_file` ou `environment` para cada serviço. A validação das variáveis (via Zod) deve ocorrer no boot de cada app, antes de qualquer uso — nunca dentro de pacotes compartilhados.

```yaml
# Exemplo no docker-compose.yml
services:
  web:
    env_file: .env
  worker:
    env_file: .env
```

---

## 4. Especificação Detalhada das Aplicações (Apps)

### 4.1. Web (`apps/web`)
O cerne do sistema atual. Toda a lógica de Next.js permanece aqui, mas de forma "enxuta".
- **Composição:** O backend do Next.js (Server Actions e API Routes) usará os serviços importados de `@silo/database` e `@silo/core`. As páginas client-side importarão componentes de `@silo/ui`.

**Refatoração dos Imports (Exemplo):**

**Antes (Monolito):**
```typescript
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { Button } from "@/components/Button";
import { formatData } from "@/lib/dateUtils";
```

**Depois (Monorepo):**
```typescript
import { db } from "@silo/database";
import { users } from "@silo/database/schema";
import { Button } from "@silo/ui/components/Button";
import { formatData } from "@silo/core/date";
```

**package.json de `apps/web`:**
```json
{
  "name": "web",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^16.1.6",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "better-auth": "^1.4.18",
    "@silo/database": "*",
    "@silo/ui": "*",
    "@silo/core": "*",
    "@silo/types": "*"
  },
  "devDependencies": {
    "@silo/typescript-config": "*",
    "@silo/eslint-config": "*"
  }
}
```

### 4.2. Worker (`apps/worker`)
O script atual de consumer Kafka (`src/scripts/kafka/consumer.ts`) será transformado em uma aplicação de primeira classe.
- **Motivo crítico:** Um consumer de Kafka em produção requer ciclos de evento puros e resiliência, além de métricas separadas do tráfego web.
- **Ferramental:** Será um app Node puro utilizando `tsx` em dev, e compilado via `tsup` ou `esbuild` em produção.

**package.json de `apps/worker`:**
```json
{
  "name": "worker",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@silo/database": "*",
    "@silo/core": "*",
    "kafkajs": "latest" 
  },
  "devDependencies": {
    "@silo/typescript-config": "*",
    "@silo/eslint-config": "*"
  }
}
```

---

## 5. Arquivos Críticos de Configuração da Raiz (Root Configs)

### 5.1 Root `package.json`
O package.json da raiz servirá unicamente para instalar dependências de orquestração do monorepo (Turborepo) e configurar as chaves do npm workspaces.

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
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "db:migrate": "npm run db:migrate -w @silo/database",
    "db:studio": "npm run db:studio -w @silo/database"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "packageManager": "npm@10.x"
}
```

### 5.2 Root `turbo.json`
O Turborepo orquestra as dependências e o grafo de build. Se o pacote `ui` mudar, apenas os apps dependentes do `ui` farão rebuild.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    "**/.env.*local"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## 6. Infraestrutura, Docker e CI/CD

Com o monorepo, precisaremos de imagens Docker isoladas. O Turborepo resolve isso muito bem com o recurso `turbo prune`.

### 6.1 Dockerfile - Aplicação Web
O Dockerfile do Next.js precisa rodar na raiz do projeto para utilizar o contexto do monorepo, mas faremos prune do escopo para diminuir o tamanho da imagem final.

```dockerfile
# Dockerfile para o Next.js (apps/web)
FROM node:20-alpine AS builder
RUN apk update && apk add --no-cache libc6-compat
RUN npm i -g turbo
WORKDIR /app
COPY . .
# Prune gera apenas os arquivos necessários para o app web
RUN turbo prune web --docker

# Instalação de dependências do esqueleto filtrado
FROM node:20-alpine AS installer
RUN apk update && apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=builder /app/out/json/ .
RUN npm install

# Build
COPY --from=builder /app/out/full/ .
RUN npx turbo run build --filter=web...

# Runner production-ready
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=installer /app/apps/web/.next/standalone ./
COPY --from=installer /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
ENV PORT 3000
ENV NODE_ENV production
CMD ["node", "apps/web/server.js"]
```

### 6.2 Dockerfile - Aplicação Worker
De maneira semelhante, teremos um Dockerfile minúsculo apenas rodando o script de background do Kafka, instanciando o container de Worker, poupando centenas de MBs de build react que estavam contidos.

```dockerfile
# Dockerfile para o Consumer Kafka (apps/worker)
FROM node:20-alpine AS builder
RUN apk update && apk add --no-cache libc6-compat
RUN npm i -g turbo
WORKDIR /app
COPY . .
RUN turbo prune worker --docker

FROM node:20-alpine AS installer
RUN apk update && apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=builder /app/out/json/ .
RUN npm install
COPY --from=builder /app/out/full/ .
RUN npx turbo run build --filter=worker...

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=installer /app/apps/worker/dist ./dist
COPY --from=installer /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

### 6.3 Orquestração (docker-compose.yml)
O `docker-compose.yml` raiz fará o mapeamento adequado, subindo três frentes principais:
1. `db` (Postgres)
2. `web` (App Next.js na porta 3000)
3. `worker` (Rodando como serviço em background sem portas abertas)

```yaml
services:
  db:
    image: postgres:17-alpine
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: silo
      POSTGRES_USER: silo
      POSTGRES_PASSWORD: silo
    
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "8084:3000"
    depends_on:
      - db

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    restart: unless-stopped
    depends_on:
      - db
```

---

## 7. Pipeline de Integração Contínua (CI/CD)

Um dos maiores ganhos do Turborepo está no Pipeline. Se um commit altera apenas o Consumer do Kafka, a pipeline de testes e build do Frontend será lida no cache em 0.5s e aprovada instantaneamente.

### Exemplo de Pipeline (GitHub Actions)

```yaml
name: CI

on:
  push:
    branches: ["main"]
  pull_request:
    types: [opened, synchronize]

jobs:
  build:
    name: Build and Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
        with:
          fetch-depth: 2

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npx turbo run lint

      - name: Typecheck
        run: npx turbo run typecheck

      - name: Build
        run: npx turbo run build
```

---

## 8. Passos Críticos e Cronograma de Migração

Para não quebrar a aplicação que já está rodando em produção (deploy via script e CI/CD), a migração deve ocorrer em fases progressivas:

### Fase 1: Setup da Infraestrutura Raiz
1. Criar branch `feature/monorepo`.
2. Mover tudo que for raiz (src, config) para um diretório temporário `./tmp-legacy`.
3. Na nova raiz, rodar `npm init -y`, instalar o Turborepo (`npm i -D turbo`) e adicionar o array `"workspaces"` no `package.json` base.
4. Criar as pastas `/apps` e `/packages`.

### Fase 2: Construção da Base (Packages core e types)
1. Criar o pacote `@silo/typescript-config` e transpor o `tsconfig.json` original de forma modular (`base.json`, `nextjs.json`, `react-library.json`).
2. Criar `@silo/types` e mover o conteúdo de `tmp-legacy/src/types/` (renomeando para kebab-case).
3. Criar `@silo/core` e migrar todos os utilitários listados na tabela da seção 3.3 (renomeando para kebab-case).
4. Adequar todos os imports internos nestes pacotes para garantir que estão auto-suficientes.

### Fase 3: Isolamento do Domínio de Dados (Database)
1. Criar o pacote `@silo/database`.
2. Mover as definições do Drizzle e a pasta `db/`.
3. Ajustar o `drizzle.config.ts` para refletir os novos caminhos relativos.
4. Adicionar script no `package.json` desse pacote para `generate`, `push` e `migrate`.
5. Testar os comandos na raiz utilizando a flag de workspace do npm: `npm run db:generate -w @silo/database`.

### Fase 4: O Design System (UI)
1. Criar o pacote `@silo/ui`.
2. Migrar os arquivos CSS globais, os componentes base e as dependências Tailwind/Radix UI.
3. Exportar todos de forma limpa no index.ts principal do UI package.

### Fase 5: Setup das Aplicações (Web e Worker)
1. Criar a estrutura do Next.js dentro de `apps/web`. Mover `src/`, `public/`, `uploads/`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vercel.json`, `entrypoint.sh` e `next-env.d.ts`.
2. Instalar internamente as dependências via workspace: `npm install @silo/ui @silo/database @silo/core -w web`.
3. Iniciar o processo de Search & Replace em massa. Padrões de import a substituir:
   - `@/lib/db` → `@silo/database`
   - `@/lib/db/schema` → `@silo/database/schema`
   - `@/components/` → `@silo/ui/components/`
   - `@/lib/dateUtils` → `@silo/core/date`
   - `@/lib/utils` → `@silo/core/utils`
   - `@/lib/validation` → `@silo/core/validation`
   - `@/lib/constants` → `@silo/core/constants`
   - `@/lib/markdown` → `@silo/core/markdown`
   - `@/lib/productStatus` → `@silo/core/product-status`
   - `@/lib/taskHistory` → `@silo/core/task-history`
   - `@/lib/api-response` → `@silo/core/api-response`
4. Criar a estrutura em `apps/worker`. Mover `src/scripts/kafka/consumer.ts` para `apps/worker/src/index.ts` e a pasta `src/lib/kafka/`.
5. Iniciar os testes locais com `npm run dev`. O Turborepo deverá orquestrar e subir o web na porta local, e o worker em background paralelamente.

### Fase 6: Ajuste CI/CD e Ambientes
1. Alterar o arquivo `.gitlab-ci.yml` (ou Github Actions) para rodar processos baseados no Turborepo (ex: `npx turbo run build`).
2. Ajustar arquivos de deploy para garantir que estão copiando as chaves certas e efetuando pull apenas do que precisam (otimização de cache baseada na árvore git).
3. Testar containerização: gerar build local através do novo docker-compose.yml, validando o isolamento do "web" e do "worker" em contêineres autossuficientes.

---

## 9. Boas Práticas Durante a Implementação

1. **Convenção de Nomenclatura (kebab-case):** Todos os arquivos de código-fonte devem seguir o padrão **kebab-case** (ex: `date-utils.ts`, `product-status.ts`, `send-email.ts`). Exceções aceitáveis: componentes React em PascalCase (`Button.tsx`, `UserCard.tsx`), arquivos de configuração de ferramentas que exigem nome específico (`Dockerfile`, `next.config.ts`) e arquivos de documentação em maiúsculas (`README.md`).
2. **Evitar Dependências Circulares:** Um pacote `packages/*` não pode, sob nenhuma hipótese, importar algo de dentro de `apps/*`. O fluxo de dependência é sempre Apps -> Packages ou Package -> Package (desde que seja um DAG hierárquico, como `ui` consumindo `types`).
3. **Uso de Variáveis de Ambiente:** Manter um único `.env` na raiz do monorepo. A validação das variáveis via Zod deve acontecer na borda — no boot de `apps/web` e `apps/worker` — nunca dentro de `packages/*`. Isso garante que a stack falhe rápido com mensagem clara se uma variável obrigatória estiver ausente.
4. **Paths Typescript Limpos:** O npm cuida dos symlinks de forma excelente com workspaces, dispensando `Project References` na maioria dos casos. Configurar `composite: true` apenas se houver necessidade explícita de builds incrementais.
5. **Instalação de Dependências:** Quando precisar instalar um pacote npm no projeto Next.js, rode na raiz do repositório: `npm install <pacote> -w web`. Quando for no UI: `npm install <pacote> -w @silo/ui`.

---

## 10. FAQ e Casos Críticos no Next.js (Turbo/Webpack)

**Aviso Importante sobre o Next.js no Monorepo:**
Por padrão, o Next.js no App Router não transpila pacotes externos automaticamente, se eles não estiverem configurados. Como `@silo/ui` conterá arquivos raw de Typescript e Tailwind, no arquivo `apps/web/next.config.ts`, é obrigatório declarar o pacote no parâmetro `transpilePackages`:

```typescript
// apps/web/next.config.ts
const nextConfig = {
  transpilePackages: ["@silo/ui", "@silo/core", "@silo/database"],
  // Outras configurações...
};
export default nextConfig;
```

**Configuração Tailwind no Monorepo:**
Para que o Tailwind, rodando dentro do Next.js em `apps/web`, consiga ler as classes aplicadas nos componentes que moram no pacote `@silo/ui`, o arquivo base de configuração (ou postcss) deve estar ciente de todos os workspaces.
O `tailwind.config.ts` (ou a versão v4) no `apps/web` deve incluir diretórios remotos na chave content:
```typescript
content: [
  "./src/**/*.{js,ts,jsx,tsx,mdx}",
  "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}"
],
```
Isso assegura que todo o CSS é corretamente expurgado e minificado para as classes puras geradas globalmente.

---
**FIM DO PLANO DIRETOR**
*A implementação deste plano exigirá atenção criteriosa em cada fase para manter o estado da aplicação estável durante todo o processo de refatoração, minimizando down-time na produtividade da equipe.*
