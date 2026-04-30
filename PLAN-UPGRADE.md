# Plano de Upgrade: Monorepo com 3 Runtimes Isolados (Silo)

Migração de Next.js monolítico → Monorepo Turborepo com `apps/web`, `apps/api`, `apps/worker` isolados e tipados via contratos.

---

## 1. Estado Atual (Problemas)

| Problema | Impacto |
|---|---|
| Next.js acessa DB direto | Pooling incontrolável, segredos expostos ao frontend |
| `better-auth` server no Next.js | Sessão no mesmo processo que serve HTML |
| API Routes sem middleware centralizado | Rate limit, auth, validação replicados |
| Kafka REST embutido no monólito | Worker sem isolamento de processo |
| Sem contratos tipados | Sem garantia TypeScript entre cliente e servidor |
| `rateLimit.ts` + `rate-limit.ts` duplicados | Risco de inconsistência |

---

## 2. Arquitetura Alvo

```
Browser → apps/web (Next.js, UI pura, sem DB)
              ↓ HTTP REST
         apps/api (Express, único acesso ao DB)
              ↓ SQL
         PostgreSQL
              
     + apps/worker (Kafka Consumer, async jobs)
```

**Regra de Ouro:** Apenas `api` e `worker` acessam `@silo/db`. `web` **nunca** importa banco.

---

## 3. Estrutura de Diretórios

```
apps/
  web/              # Next.js UI pura
  api/              # Express backend
  worker/           # Kafka consumer
packages/
  config/           # typescript, eslint, tailwind
  contracts/        # Tipos + Kafka topics + Schemas Zod
  db/               # Drizzle schema + migrations
  domain/           # product-status, task-history, etc
  core/             # date-utils, email, validation
  ui/               # Design system React
```

---

## 4. Os Runtimes

### apps/web — Next.js (UI Pura)
- Sem `DATABASE_URL`, sem `BETTER_AUTH_SECRET`
- Consome API via `@silo/contracts` tipados
- Login: SDK client-side do better-auth → `apps/api/auth/*`
- `/api/auth/*` (callback OAuth), `/api/revalidate` (ISR)

### apps/api — Express (Backend)
- Única porta de acesso ao banco
- Middleware: auth (better-auth), RBAC, rate-limit, validação Zod
- Services: funções puras testáveis, sem dependência Express
- Producer Kafka: publica eventos tipados

### apps/worker — Kafka Consumer
- Processa eventos assincronamente (email, status sync)
- Acessa banco via `@silo/db`
- Não expõe porta HTTP
- Tipado com eventos de `@silo/contracts`

---

## 5. Pacotes Compartilhados

| Pacote | Conteúdo | Pode importar |
|---|---|---|
| `@silo/contracts` | Tipos, `KAFKA_TOPICS`, Zod schemas | Zod |
| `@silo/db` | Drizzle schema, migrations, seed | @silo/config |
| `@silo/domain` | product-status, task-history, etc | @silo/contracts, @silo/core |
| `@silo/core` | date-utils, email, validation, auth/hash | @silo/config |
| `@silo/ui` | Componentes React burros | @silo/core, @silo/contracts (tipos) |
| `@silo/config` | TypeScript, ESLint, Tailwind | - |

---

## 6. Regras de Fronteira

```
apps/web   → @silo/contracts, @silo/ui, @silo/core
apps/api   → @silo/contracts, @silo/db, @silo/domain, @silo/core
apps/worker → @silo/contracts, @silo/db, @silo/domain, @silo/core

Proibido: packages/* importar de apps/*
Proibido: apps/web importar @silo/db ou @silo/domain
```

---

## 7. Padrões

### Services (apps/api/src/services/)
```typescript
// ✅ Funções puras, testáveis
export async function listProducts(filters): Promise<ProductDto[]> { ... }

// ❌ Errado
export async function listProducts(req, res): Promise<void> { ... }
```

### Kafka Topics
```typescript
// ✅ Sempre de KAFKA_TOPICS
import { KAFKA_TOPICS } from "@silo/contracts"
await publishEvent(KAFKA_TOPICS.PRODUCT_STATUS_CHANGED, event)

// ❌ Errado
await publishEvent("product.status.changed", event)
```

### Nomenclatura
- `kebab-case.ts` para todos os arquivos
- `PascalCase.tsx` apenas para componentes React
- `routes/*.ts` = Express Router
- `services/*.ts` = Lógica pura
- `middleware/*.ts` = Função Express
- `handlers/*.ts` = Handler Kafka (apenas worker)

---

## 8. Variáveis de Ambiente (Segregação)

| Variável | web | api | worker |
|---|:---:|:---:|:---:|
| `DATABASE_URL` | ❌ | ✅ | ✅ |
| `KAFKA_REST_URL` | ❌ | ✅ | ✅ |
| `BETTER_AUTH_SECRET` | ❌ | ✅ | ❌ |
| `SMTP_HOST` / `SMTP_*` | ❌ | ✅ | ✅ |
| `NEXT_PUBLIC_API_URL` | ✅ | ❌ | ❌ |
| `WEB_URL` | ❌ | ✅ | ❌ |

---

## 9. Checklist de Validação Final

```bash
# apps/web não acessa banco
grep -r "@silo/db\|@silo/domain\|drizzle" apps/web/src/

# Nenhuma string Kafka hardcoded
grep -rE '(product\.|task\.|incident\.|email\.)' apps/api/src/ apps/worker/src/

# Services são funções puras (sem Request/Response nos params)
grep -rn "Request.*Response" apps/api/src/services/

# @silo/contracts sem deps de runtime
cat packages/contracts/package.json | grep -E "express|next|react|drizzle"

# npm run typecheck, lint, build, dev — todos passam
npm run typecheck
npm run lint
npm run build
npm run dev
```

---

## Detalhes de Execução

**Tarefas específicas, critérios de aceite e dependências entre sprints:**
→ Ver **PLAN-UPGRADE-SPRINTS.md**

Cada sprint em SPRINTS.md tem:
- **Tarefas:** CREATE, MOVE, DELETE, MODIFY explícitas
- **Critérios de aceite:** Verificáveis objetivamente (grep, testes, builds)
- **Dependências:** Ordem de execução, paralelizações permitidas
