---
description: "Use when creating or modifying API Route Handlers, Server Actions, validating request data, or handling API errors. Covers the SILO API response contract and authentication patterns."
applyTo: "apps/web/src/app/api/**/*.ts"
---

# API Patterns — Route Handlers (SILO)

Referência completa: [docs/06-api.md](../../docs/06-api.md)

---

## Contrato de resposta

O projeto usa dois padrões de resposta:

```typescript
// 1) Padrão geral — /api/admin/*
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

// 2) Padrão de formulário — /api/auth/*, /api/user-*
type FormResponse = {
  field: string | null;  // campo com erro, ou null se erro geral
  message: string;
};
```

---

## Template de Route Handler

```typescript
// apps/web/src/app/api/admin/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@silo/database";
import { product } from "@silo/database/schema";
import { getAuthUser } from "@/lib/auth/token";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Não autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const [newProduct] = await db.insert(product)
      .values({ ...parsed.data, createdBy: user.id })
      .returning();

    return NextResponse.json({ success: true, data: newProduct }, { status: 201 });
  } catch (error) {
    console.error("❌ [POST /api/admin/products]", { error });
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
```

---

## Segmentos dinâmicos

```typescript
// apps/web/src/app/api/admin/products/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

---

## Autenticação em Route Handlers

```typescript
import { getAuthUser } from "@/lib/auth/token";

const user = await getAuthUser(request);
if (!user) {
  return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
}

// Verificar permissão de admin
import { checkAdminPermission } from "@/lib/permissions/check";
const isAdmin = await checkAdminPermission(user.id);
if (!isAdmin) {
  return NextResponse.json({ success: false, error: "Acesso negado" }, { status: 403 });
}
```

---

## Validação com Zod

```typescript
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  role: z.enum(["admin", "user"]),
});

const parsed = schema.safeParse(await request.json());
if (!parsed.success) {
  return NextResponse.json(
    { success: false, error: parsed.error.issues[0].message },
    { status: 400 }
  );
}
const { name, email, role } = parsed.data;
```

---

## Logs

Use o padrão de log com emoji e contexto — ver [docs/11-logs.md](../../docs/11-logs.md):

```typescript
console.log("✅ [PRODUTO] Criado com sucesso", { id: newProduct.id, name });
console.error("❌ [PRODUTO] Erro ao criar", { error: error.message });
console.warn("⚠️ [PRODUTO] Tentativa sem permissão", { userId: user.id });
```

---

## Rate limiting

```typescript
import { rateLimit } from "@/lib/rate-limit";

const allowed = await rateLimit(request, { max: 10, window: 60 });
if (!allowed) {
  return NextResponse.json(
    { success: false, error: "Muitas tentativas. Aguarde." },
    { status: 429 }
  );
}
```

---

## Regras

- Sempre use `try/catch` em todos os Route Handlers.
- Valide input no início, antes de qualquer operação de banco.
- Nunca exponha detalhes internos de erro para o cliente (stack traces, queries, etc.).
- Use status HTTP corretos: `200`, `201`, `400`, `401`, `403`, `404`, `500`.
- Nunca use `process.env` diretamente — use `@/lib/config`.
