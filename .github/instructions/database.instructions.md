---
description: "Use when working with database schema, Drizzle ORM queries, migrations, transactions, or any file that imports from @silo/database. Covers schema conventions, query patterns, and migration workflow."
applyTo: "packages/db/**/*.{ts,sql}"
---

# Banco de Dados — Drizzle ORM (SILO)

Referência completa: [docs/04-database.md](../../docs/04-database.md)

---

## Importações

```typescript
// Conexão e query builder
import { db } from "@silo/database";

// Schema — tabelas e relações
import { authUser, product, project } from "@silo/database/schema";

// Tipagem via Drizzle
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type AuthUser = InferSelectModel<typeof authUser>;
export type NewAuthUser = InferInsertModel<typeof authUser>;
```

---

## Padrões de query

```typescript
import { db } from "@silo/database";
import { product } from "@silo/database/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

// SELECT com filtro
const products = await db.select()
  .from(product)
  .where(and(eq(product.active, true), isNull(product.deletedAt)))
  .orderBy(desc(product.createdAt));

// SELECT com relações (query API)
const productWithDetails = await db.query.product.findFirst({
  where: eq(product.id, id),
  with: {
    problems: true,
    solutions: true,
  },
});

// INSERT
const [newProduct] = await db.insert(product)
  .values({ name, description, createdBy: userId })
  .returning();

// UPDATE
await db.update(product)
  .set({ name, updatedAt: new Date() })
  .where(eq(product.id, id));

// DELETE (soft delete preferido)
await db.update(product)
  .set({ deletedAt: new Date() })
  .where(eq(product.id, id));
```

---

## Transações

```typescript
import { db } from "@silo/database";

await db.transaction(async (tx) => {
  const [newProject] = await tx.insert(project)
    .values({ name, createdBy: userId })
    .returning();

  await tx.insert(projectUser)
    .values({ projectId: newProject.id, userId, role: "admin" });
});
```

---

## Schema — fonte de verdade

O schema fica em `packages/db/src/schema/index.ts`. **Nunca** modifique o banco diretamente.

Fluxo para alterar o schema:
1. Editar `packages/db/src/schema/index.ts`
2. Gerar migration: `npm run db:generate`
3. Revisar o SQL gerado em `packages/db/drizzle/`
4. Aplicar: `npm run db:migrate`

---

## Migrations

```bash
npm run db:generate   # gera SQL a partir do schema
npm run db:migrate    # aplica migrations pendentes
npm run db:studio     # interface visual (Drizzle Studio)
```

---

## Boas práticas

- Use **soft delete** (`deletedAt: timestamp`) em vez de `DELETE` físico para entidades importantes.
- Sempre use `returning()` após `insert` ou `update` quando precisar do registro resultante.
- Prefira a **query API** (`db.query.*`) para joins complexos com relações definidas no schema.
- Use `eq`, `and`, `or`, `isNull`, `inArray` do `drizzle-orm` — nunca SQL raw sem necessidade.
- Nunca exponha tipos de banco diretamente na API — mapeie para contratos em `@silo/engine/contracts/*`.
