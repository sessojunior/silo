---
description: "Use when creating or modifying API Route Handlers, Server Actions, validating request data, or handling API errors. Covers the SILO API response contract and authentication patterns."
applyTo: "apps/web/app/api/**/*.ts"
---

# API Patterns — Route Handlers (SILO)

Referência completa: [docs/06-api.md](../../docs/06-api.md)

---

## Arquitetura das rotas

```
apps/web/app/api/
  admin/[...path]/route.ts  # catch-all proxy → apps/api (autentica no api)
  auth/                     # login, logout, OTP — lógica local no web
  (user)/                   # rotas do perfil do usuário autenticado
  upload/                   # upload de imagens
  product-flow/             # fluxo de produto
```

As rotas em `/api/admin/*` **não acessam o banco diretamente** — são um proxy reverso para `apps/api`.  
As rotas em `/api/auth/*` e `/api/(user)/*` têm lógica local e podem chamar `apps/api` via fetch.

---

## Contrato de resposta

Tipo definido em `@/lib/api-response`:

```typescript
type ApiResponse<T = unknown> = {
  ok?: boolean;
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  field?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: unknown;
  };
};
```

Helpers disponíveis em `@/lib/api-response`:

```typescript
import { errorResponse } from "@/lib/api-response";

return errorResponse("Não autorizado.", 401);           // Response JSON com success: false
return NextResponse.json({ success: true, data }, { status: 200 });
```

---

## Template de Route Handler

```typescript
// apps/web/app/api/(user)/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/server";
import { errorResponse } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    // lógica aqui...

    return NextResponse.json({ success: true, data: { id: user.id } }, { status: 200 });
  } catch (error) {
    console.error("❌ [POST /api/(user)/profile]", { error });
    return errorResponse("Erro interno do servidor.", 500);
  }
}
```

---

## Segmentos dinâmicos

```typescript
// apps/web/app/api/(user)/profile/[id]/route.ts
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
import { getAuthUser, requireAuthUser, requireAdminAuthUser } from "@/lib/auth/server";

// Retorna o usuário ou null (sem lançar)
const user = await getAuthUser();
if (!user) return errorResponse("Não autorizado.", 401);

// Guard: retorna response pronta se não autenticado
const authResult = await requireAuthUser();
if (!authResult.ok) return authResult.response;
const { user } = authResult;

// Guard admin: verifica autenticação + permissão de admin via apps/api
const adminResult = await requireAdminAuthUser();
if (!adminResult.ok) return adminResult.response;
const { user } = adminResult;
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
  return errorResponse(parsed.error.issues[0].message, 400);
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

## Regras

- Sempre use `try/catch` em todos os Route Handlers.
- Valide input no início, antes de qualquer operação de banco.
- Nunca exponha detalhes internos de erro para o cliente (stack traces, queries, etc.).
- Use status HTTP corretos: `200`, `201`, `400`, `401`, `403`, `404`, `429`, `500`.
- Nunca use `process.env` diretamente — use `@/lib/config`.
- `getAuthUser()` não recebe parâmetros — usa `headers()` do Next.js internamente.
- Para verificar admin, use `requireAdminAuthUser()` — nunca implemente a lógica inline.
