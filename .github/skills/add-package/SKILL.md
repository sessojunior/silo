---
name: add-package
description: "Create or update package structure in SILO monorepo only when justified. Use when: package is reused by 2+ apps or is fundamental infrastructure (db/config/engine). Avoid generic utility packages."
argument-hint: "Package name (e.g. notifications, jobs, search)"
---

# Add Package — @silo/* Monorepo

## When to Use

- Criar package apenas quando houver reuso por 2+ apps
- Criar package para camada fundamental (db, engine, config)
- Reorganizar package existente sem aumentar quantidade de packages

## Quando NÃO usar

- Não criar packages genéricos como `utils`, `helpers`, `hooks` ou `types`
- Não extrair código específico de `web`, `api` ou `worker` para package sem justificativa clara

## Procedure

### 1. Determine the package purpose

No SILO, `packages/` deve permanecer enxuto.

Use apenas estas categorias:

| Category | Folder pattern | Example |
|---|---|---|
| Core de regras | `packages/engine/` | `@silo/engine` |
| Banco | `packages/db/` | `@silo/database` |
| Config compartilhada | `packages/config/<name>/` | `@silo/eslint-config` |

### 2. Create the folder and core files

Create `packages/<name>/` with:

- `package.json`
- `tsconfig.json`
- `src/index.ts` — barrel export file

### 3. Wire up package.json

**Template mínimo:**

```json
{
  "name": "@silo/<name>",
  "version": "0.1.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "devDependencies": {
    "@silo/typescript-config": "*",
    "typescript": "^5.9.3"
  }
}
```

**Com subexports e dependências (ex: domínio que usa engine e banco):**

```json
{
  "name": "@silo/<name>",
  "version": "0.1.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./utils": "./src/utils.ts",
    "./types": "./src/types.ts"
  },
  "dependencies": {
    "@silo/database": "*",
    "@silo/engine": "*"
  },
  "devDependencies": {
    "@silo/typescript-config": "*",
    "typescript": "^5.9.3"
  }
}
```

**Com build script (ex: @silo/database):**

```json
{
  "name": "@silo/<name>",
  "version": "0.1.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@silo/typescript-config": "*",
    "typescript": "^5.9.3"
  }
}
```

Rules:
- `name` must be `@silo/<name>` (kebab-case)
- `exports` aponta para `.ts` direto (sem build step para consumo interno)
- Add `@silo/database`, `@silo/engine`, etc. to `dependencies` only if needed
- **Never** add `apps/*` as a dependency

### 4. Wire up tsconfig.json

**Template padrão** (a maioria dos pacotes):

```json
{
  "extends": "@silo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Com noEmit** (pacote consumido diretamente via TypeScript):

```json
{
  "extends": "@silo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

O `@silo/typescript-config/base.json` já fornece: `target: ES2022`, `moduleResolution: bundler`, `strict: true`, `esModuleInterop: true`, `resolveJsonModule: true`, `skipLibCheck: true` — não repetir.

### 5. Add src/index.ts

```typescript
// Export the public API of this package
export * from "./your-module";
```

### 6. Register in root package.json workspaces (if not auto-detected)

Check `package.json` at the root — workspaces glob is `"packages/*"` so any direct child of `packages/` is picked up automatically. For `packages/config/*`, it's also covered by `"packages/config/*"`.

### 7. Consume the package from an app

In the consuming app's `package.json`:

```json
{
  "dependencies": {
    "@silo/<name>": "*"
  }
}
```

Then run:

```bash
npm install
```

Import in code:

```typescript
import { something } from "@silo/<name>";
```

### 8. Verify

```bash
npm run typecheck
npm run build
```

## Key Constraints

- Packages **never** import from `apps/*`
- `@silo/engine` não deve importar `@silo/database`
- No `process.env` reads in packages — receive config as function parameters
- Folder name is kebab-case; `name` in package.json is `@silo/<folder-name>`
