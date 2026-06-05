---
name: add-app
description: "Create a new app in the SILO monorepo under apps/. Use when: scaffolding a new Next.js app, Express API, or Node.js worker; adding a new app workspace; wiring workspace scripts; setting up app-level package.json, tsconfig.json, and environment config."
argument-hint: "App name and type (e.g. admin-web nextjs, jobs-api express, sync-worker node)"
---

# Add App — SILO Monorepo

## When to Use

- Adding a new frontend (Next.js App Router)
- Adding a new backend service (Express)
- Adding a new background worker (Node.js / Kafka consumer)

## Procedure

### 1. Choose the app type

| Type | Base template | Example |
|---|---|---|
| Next.js frontend | `apps/web` structure | `apps/admin/` |
| Express API | `apps/api` structure | `apps/jobs-api/` |
| Node.js worker | `apps/worker` structure | `apps/sync-worker/` |

### 2. Create the app folder and core files

Create `apps/<name>/` with:

- `package.json` — see template below
- `tsconfig.json`
- `src/index.ts` (worker/api) or `src/app/` (Next.js)

### 3. package.json template

**Express API / Worker:**

```json
{
  "name": "@silo/<name>",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@silo/engine": "*",
    "@silo/database": "*",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  },
  "devDependencies": {
    "@types/node": "^25.0.0"
  }
}
```

**Next.js:**

```json
{
  "name": "@silo/<name>",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@silo/engine": "*",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

### 4. tsconfig.json

**Express API / Worker** (usa `@silo/typescript-config/base.json`):

```json
{
  "extends": "@silo/typescript-config/base.json",
  "compilerOptions": {
    "module": "preserve",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Next.js** (padrão com `src/` obrigatório):

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

### 5. Environment config

Every app must validate its environment variables at boot using Zod:

```typescript
// src/lib/config.ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  // add more vars as needed
});

export const config = schema.parse(process.env);
```

- Variables are read from `.env` at the monorepo root
- **Never** use `process.env.VAR` directly — always go through `config`
- Packages that this app depends on receive config as function parameters

### 6. Register workspace scripts

The root `package.json` exposes the common workspace scripts (`build`, `lint`, `test`, `typecheck`) and the per-app dev commands (`dev:web`, `dev:api`, `dev:worker`). Add app-specific scripts in the app package.json and mirror them at the root only when you want a repo-level entry point.

To run only this app in dev:

```bash
# or
npm run dev -w @silo/<name>
```

### 7. Register in root package.json

The root `package.json` has `"workspaces": ["apps/*", ...]`, so any new folder under `apps/` is picked up automatically after `npm install`.

```bash
npm install
```

### 8. Verify

```bash
npm run typecheck
npm run build
```

## Key Constraints

- Apps may import from any `packages/*` but **never** from other `apps/*`
- `apps/web` não deve acessar banco diretamente (`web -> api -> db`)
- No `process.env` reads outside `src/lib/config.ts`
- App names follow the pattern `@silo/<app-name>` in package.json
