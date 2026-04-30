# Plano de Execução por Sprints — Upgrade Silo (Monorepo + 3 Runtimes)

Migração monólito Next.js → Monorepo Turborepo com `apps/web`, `apps/api`, `apps/worker`.

---

## Sprints Overview

| Sprint | Foco | Dependências |
|---|---|---|
| S1 | Monorepo scaffold + turbo + packages/config | - |
| S2 | `@silo/db` + `@silo/core` | S1 |
| S3 | `@silo/ui` + `@silo/types` | S1, S2 |
| S4 | `@silo/contracts` + `@silo/domain` | S2, S3 |
| S5 | `apps/api` scaffold + better-auth + middleware | S1, S2, S4 |
| S6 | `apps/api`: products, projects, tasks, incidents | S5 |
| S7 | `apps/api`: users, groups, contacts, help, chat, dashboard, upload | S6 |
| S8 | `apps/web`: remove DB, usar api-client | S4, S7 |
| S9 | `apps/worker`: mover Kafka code, tipar events | S4, S5 |
| S10 | Docker, docker-compose.yml, CI/CD pipeline | S8, S9 |

---

## S1 — Monorepo Scaffold + Tooling

- [ ] `MODIFY` `/package.json`: workspaces, turbo, dev/build/lint/typecheck scripts
- [ ] `CREATE` `turbo.json`: tasks config
- [ ] `CREATE` `packages/config/typescript-config/`: base.json, nextjs.json, react-library.json
- [ ] `CREATE` `packages/config/eslint-config/`: library.js, next.js
- [ ] `CREATE` `packages/config/tailwind-config/`: tailwind.config.ts
- [ ] `MOVE` current `src/`, `public/`, `next.config.ts`, etc → `apps/web/`
- [ ] `CREATE` `apps/api/package.json`, `tsconfig.json`, `src/index.ts` (GET /health)
- [ ] `CREATE` `apps/worker/package.json`, `tsconfig.json`

**Aceite:** `npm run dev` inicia web, api, worker sem erros.

---

## S2 — @silo/db + @silo/core

**`packages/db`:**
- [ ] `MOVE` `src/lib/db/schema.ts` → `packages/db/src/schema/index.ts`
- [ ] `MOVE` `src/lib/db/`, `drizzle/`, `drizzle.config.ts` → `packages/db/`
- [ ] `MOVE` seed files: seed-data.ts, seed-pictures.ts, seed-products.ts, seed-radars.ts, seed-types.ts

**`packages/core`:**
- [ ] `MOVE` date-utils.ts, date-config.ts, config.ts, constants.ts, utils.ts, validation.ts, markdown.ts
- [ ] `MOVE` `src/lib/auth/hash.ts`, `src/lib/email/`
- [ ] `DELETE` `src/lib/rateLimit.ts` (duplicate legado)

**`apps/web` + `apps/worker`:**
- [ ] `MODIFY` imports: `@/lib/date-utils` → `@silo/core/date`, etc
- [ ] `MODIFY` `next.config.ts`: transpilePackages: ["@silo/core"]

**Aceite:** `npm run typecheck` green; `npm run db:migrate` works.

---

## S3 — @silo/ui + @silo/types

- [ ] `MOVE` `src/types/` → `packages/types/src/`
- [ ] `MOVE` `src/components/`, `src/hooks/` (UI pure), `src/context/`, `src/app/globals.css` → `packages/ui/src/`
- [ ] `MODIFY` `apps/web`: imports `@/components/` → `@silo/ui/components/`
- [ ] `MODIFY` tailwind content: include `../../packages/ui/src/**`

**Aceite:** `npm run build -w web` passes; UI renders correctly.

---

## S4 — @silo/contracts + @silo/domain

**`packages/contracts`:**
- [ ] `CREATE` api-response.ts, kafka-events.ts (KAFKA_TOPICS + DomainEvent union)
- [ ] `CREATE` DTOs + Zod schemas: users.ts, groups.ts, products.ts, projects.ts, incidents.ts, tasks.ts, contacts.ts, help.ts, chat.ts, upload.ts

**`packages/domain`:**
- [ ] `MOVE` `packages/core/src/product-status.ts` → `packages/domain/src/product-status.ts`
- [ ] `MOVE` product-activity-history.ts, task-history.ts → domain/
- [ ] `MODIFY` `packages/core/package.json`: remove exports for domain files

**Aceite:** `npm run typecheck` green; `@silo/contracts` has zero runtime deps (no express/react/drizzle).

---

## S5 — apps/api: Bootstrap + Auth + Middleware

- [ ] `CREATE` `apps/api/src/middleware/auth.ts`, permissions.ts, rate-limit.ts, validate.ts
- [ ] `MOVE` `apps/web/src/lib/auth/server.ts` → `apps/api/src/lib/auth.ts`
- [ ] `CREATE` `apps/api/src/routes/auth.ts` (better-auth handler)
- [ ] `CREATE` `apps/api/src/lib/kafka.ts` (moved from src/lib/kafka-rest.ts)
- [ ] `MODIFY` `apps/api/src/index.ts`: cors, middlewares, routers, GET /health

**Aceite:** `npm run dev -w api` starts on 3001; GET /health returns OK.

---

## S6 — apps/api: Domínios Principais

**Services (S6):** product-service.ts, project-service.ts, task-service.ts, incident-service.ts  
**Routes:** /products, /projects, /tasks, /incidents

- [ ] Create services + routes (crud ops, publish Kafka events)
- [ ] `MODIFY` `apps/web/src/app/api/admin/*/route.ts`: proxy to `API_URL/*`

**Aceite:** GET /products returns list; POST /products creates item (with auth).

---

## S7 — apps/api: Domínios Restantes

**Services:** user-service.ts, group-service.ts, contact-service.ts, help-service.ts, chat-service.ts, dashboard-service.ts, report-service.ts, monitoring-service.ts  
**Routes + Upload:** /users, /groups, /contacts, /help, /chat, /dashboard, /reports, /monitoring, /upload (multer)

- [ ] Create all services + routes
- [ ] `CREATE` `apps/api/src/lib/uploads.ts` (moved from src/lib/local-uploads.ts + profile-image.ts)
- [ ] `CREATE` `apps/api/uploads/` subdir structure

**Aceite:** All routes respond via api; upload returns URL; admin panel works via proxies.

---

## S8 — apps/web: Remove DB

- [ ] `CREATE` `apps/web/src/lib/api-client.ts` (typed fetch wrapper via @silo/contracts)
- [ ] `MODIFY` `admin/*` pages: `fetch("/api/...")` → `apiClient.get<ContractType>(...)`
- [ ] `DELETE` `apps/web/src/app/api/admin/` (remove proxies)
- [ ] `DELETE` `apps/web/src/lib/rate-limit.ts`, `src/lib/local-uploads.ts`, `src/lib/profile-image.ts`
- [ ] `DELETE` `src/lib/permissions/`, `src/lib/auth/server.ts`
- [ ] `MODIFY` `apps/web/package.json`: remove @silo/db, add .env vars (API_URL, NEXT_PUBLIC_API_URL)

**Aceite:** `grep -r "@silo/db" apps/web/` returns zero; admin panel works; `npm run build -w web` green.

---

## S9 — apps/worker: Eventos Tipados

- [ ] `CREATE` `apps/worker/src/lib/kafka.ts` (REST consumer, moved from src/lib/kafka-rest.ts)
- [ ] `MOVE` `src/lib/kafka/topic-handlers.ts` → `apps/worker/src/lib/topic-handlers.ts` (import KAFKA_TOPICS from @silo/contracts)
- [ ] `MOVE` `src/lib/kafka/handlers/` → `apps/worker/src/lib/handlers/`
- [ ] `CREATE` `apps/worker/src/index.ts` (consumer entry, based on src/scripts/kafka/consumer.ts)
- [ ] `DELETE` `src/scripts/kafka/consumer.ts`, `src/lib/kafka/`

**Aceite:** `npm run dev -w worker` starts; processes Kafka events; no @silo/core/kafka-rest refs remain.

---

## S10 — Docker + CI/CD + Observabilidade

**Dockerfiles:**
- [ ] `CREATE` `apps/web/Dockerfile`, `apps/api/Dockerfile`, `apps/worker/Dockerfile` (multi-stage, turbo prune)
- [ ] `MODIFY` `apps/web/next.config.ts`: output: "standalone"

**Docker Compose:**
- [ ] `CREATE` `docker-compose.yml`: postgres, kafka, zookeeper, kafka-rest, api, worker, web

**CI/CD:**
- [ ] `CREATE` `.github/workflows/ci.yml`: typecheck, lint, build via turbo

**Cleanup:**
- [ ] Delete old plan files, `tmp-legacy/`, old upload location
- [ ] Update `README.md`, `docs/api-endpoints.md`, `docs/kafka-events.md`

**Aceite:** `docker compose up` all services running; CI pipeline passes; `npm run typecheck` + `npm run lint` + `npm run build` green.

---

## Validação Final

```bash
# Fronteiras respeitadas
grep -r "@silo/db\|@silo/domain\|drizzle" apps/web/src/          # zero
grep -r "apps/" packages/                                         # zero
grep -r "request.*response" apps/api/src/services/               # zero (services são puras)

# Kafka tipado
grep -rE "product\.|task\.|incident\.|email\." apps/ | grep -v KAFKA_TOPICS  # zero hardcodes

# Build
npm run typecheck && npm run lint && npm run build && npm run dev
```

---

## Padrão Proxy Temporário (S6-S7)

```typescript
// apps/web/src/app/api/admin/products/route.ts
export async function GET(req) {
  return fetch(`${process.env.API_URL}/products`, {
    headers: { cookie: req.headers.get("cookie") },
  })
}
```

Remove-se após S8 quando web consumir diretamente.

---

## Dependências Visuais

```
S1   ────────────────────────────────────────────────────────────────
        ├─S2────────────────────────────────────────────────────────
        │ ├─S3────────────────────────────────────────────────────
        │ │ ├─S4────────────────────────────────────────────────
        │ │ │ ├─S5 ──┬─S6─S7 ──┬─S8─┐
        │ │ │ │      │        │   ├─S10
        │ │ │ └──────┘─S9─────┴───┘
```

- **S1-S5** sequenciais (S5 depende de S4, etc)
- **S6-S7** sequenciais (S7 após S6)
- **S8 + S9** paralelos (ambos dependem de S4)
- **S10** após S8 + S9

---

Fim. Detalhes arquiteturais: **PLAN-UPGRADE.md**
