---
description: "Use when working with Next.js routes, layouts, components, Server Actions, Route Handlers, Metadata API, or any file inside apps/web/. Covers Next.js 16 App Router conventions for this project."
applyTo: "apps/web/**/*.{ts,tsx}"
---

# Next.js 16 — App Router (SILO)

Referência: [nextjs.org/docs](https://nextjs.org/docs)

---

## Princípios do App Router

- **Server Components são o padrão.** Todo arquivo `.tsx` em `app/` é Server Component a menos que declare `"use client"`.
- Use `"use client"` apenas quando necessário: estado local, hooks, eventos de browser, contextos.
- Use `"use server"` em Server Actions (funções assíncronas chamadas do cliente que rodam no servidor).

---

## Estrutura de arquivos especiais

| Arquivo | Propósito |
|---|---|
| `layout.tsx` | Layout compartilhado entre rotas filhas |
| `page.tsx` | Página renderizável da rota |
| `loading.tsx` | UI de carregamento (React Suspense automático) |
| `error.tsx` | Boundary de erro (deve ser `"use client"`) |
| `not-found.tsx` | Resposta 404 |
| `route.ts` | Route Handler (API endpoint — não usa JSX) |

---

## Server vs Client Components

```tsx
// Server Component (padrão) — pode usar await, db, secrets
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await db.query.products.findFirst({ where: eq(products.id, id) });
  return <div>{product?.name}</div>;
}

// Client Component — usa estado, eventos
"use client";
import { useState } from "react";
export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

---

## Route Handlers (API Routes)

Localização: `apps/web/app/api/**/*.ts` — arquivo `route.ts`.

```typescript
// apps/web/app/api/admin/products/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // ...
}

export async function POST(request: NextRequest) {
  // ...
}
```

Segmentos dinâmicos: `[id]/route.ts` → segundo argumento `{ params: Promise<{ id: string }> }`.

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
}
```

---

## Server Actions

```typescript
// Arquivo separado ou inline com "use server"
"use server";

export async function updateProduct(formData: FormData) {
  const name = formData.get("name");
  if (typeof name !== "string" || !name) throw new Error("Nome inválido.");
  await db.update(products).set({ name }).where(eq(products.id, id));
  revalidatePath("/admin/products");
}
```

---

## Metadata API

```typescript
// Em qualquer layout.tsx ou page.tsx (Server Component)
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Produtos | SILO",
  description: "Gerenciamento de produtos industriais",
};

// Metadata dinâmica
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  return { title: `${product.name} | SILO` };
}
```

---

## Versão da Aplicação

- A versão exibida na interface do `apps/web` fica centralizada em `apps/web/src/lib/config.ts` como `config.appVersion`.
- Não usar `process.env`, build args, variáveis de CI, `package.json` ou metadata de Git para esse valor.
- Quando a UI mudar e a versão precisar acompanhar, atualizar o mesmo arquivo no mesmo change.
- O sidebar deve consumir `config.appVersion` diretamente, sem helper extra, contexto ou hook.

---

## Navegação

```typescript
// Em Server Components — use <Link>
import Link from "next/link";
<Link href="/admin/products">Produtos</Link>

// Em Client Components — use useRouter
"use client";
import { useRouter } from "next/navigation";
const router = useRouter();
router.push("/admin/products");

// Redirect em Server Actions / Route Handlers
import { redirect } from "next/navigation";
redirect("/login");

// Ler path atual em Client Component
import { usePathname, useSearchParams } from "next/navigation";
```

---

## Params e SearchParams

Em Next.js 16, `params` e `searchParams` são `Promise<>`:

```typescript
// page.tsx
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
}
```

---

## Image e Font

```tsx
import Image from "next/image";
<Image src="/images/logo.png" alt="Logo" width={200} height={50} />

// Fontes locais (zero layout shift)
import localFont from "next/font/local";
const myFont = localFont({ src: "./fonts/MyFont.woff2" });
```

---

## Caching e Revalidação

```typescript
// Revalidar após mutação
import { revalidatePath, revalidateTag } from "next/cache";
revalidatePath("/admin/products");

// Fetch com cache controlado
fetch(url, { next: { revalidate: 60 } });  // ISR — revalidar a cada 60s
fetch(url, { cache: "no-store" });          // Sem cache (dados dinâmicos)
```

---

## Cookies e Headers

```typescript
import { cookies, headers } from "next/headers";

// Server Component / Route Handler
const cookieStore = await cookies();
const token = cookieStore.get("token")?.value;

const headersList = await headers();
const userAgent = headersList.get("user-agent");
```

---

## after() — código pós-resposta

Next.js 16 suporta `after()` para executar código após a resposta ser enviada:

```typescript
import { after } from "next/server";

export async function POST(request: NextRequest) {
  const data = await request.json();
  after(() => {
    // Executado após a resposta — bom para logs, analytics, etc.
    logActivity(data);
  });
  return NextResponse.json({ success: true });
}
```

---

## Padrões a evitar

- Nunca usar `process.env` diretamente — use `@/lib/config`.
- Nunca usar `next/router` (Pages Router) — use `next/navigation`.
- Não marcar Server Components como `"use client"` sem necessidade.
- Não fazer fetch de dados em Client Components quando Server Component basta.
