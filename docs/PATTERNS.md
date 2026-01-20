# 📐 Padrões de Desenvolvimento

Documentação sobre padrões, convenções e boas práticas do projeto SILO.

---

## 📋 **ÍNDICE**

1. [Imports e Estrutura](#-imports-e-estrutura)
2. [Error Handling](#-error-handling)
3. [Qualidade e Tipagem](#-qualidade-e-tipagem)
4. [Datas e Timezone](#-datas-e-timezone)
5. [URLs e Configuração](#-urls-e-configuração)
6. [Componentes React](#-componentes-react)
7. [APIs](#-apis)
8. [Banco de Dados](#-banco-de-dados)

---

## 📦 **IMPORTS E ESTRUTURA**

### **Imports**

**✅ SEMPRE** usar alias `@/` para imports internos:

```typescript
// ✅ Correto
import { sendEmail } from "@/lib/sendEmail";
import { db } from "@/lib/db";
import { User } from "@/types";

// ❌ Incorreto
import { sendEmail } from "../../../lib/sendEmail";
import { db } from "../db";
```

**Centralizar configurações:**

```typescript
// ✅ Correto
import { config } from "@/lib/config";

// ❌ Incorreto
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

### **Organização de Imports**

```typescript
// 1. React e Next.js
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 2. Bibliotecas externas
import { z } from "zod";

// 3. Imports internos (com @/)
import { Button } from "@/components/ui/Button";
import { db } from "@/lib/db";

// 4. Tipos
import type { User } from "@/types";
```

---

## ⚠️ **ERROR HANDLING**

### **Try/Catch Obrigatório**

**✅ SEMPRE** usar try/catch com logs:

```typescript
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validação
    if (!data.email) {
      return NextResponse.json(
        { success: false, error: "Email é obrigatório" },
        { status: 400 },
      );
    }

    // Operação
    const result = await saveData(data);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("❌ [API_NAME] Erro", { error: error.message });
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
```

### **Padrão de Resposta**

O código atual possui dois padrões principais:

- **ApiResponse** (muito comum em `/api/admin/*`): `success/data/error/message`
- **FormResponse** (muito comum em `/api/auth/*` e `/api/user-*`): `field/message`

```typescript
// Sucesso (ApiResponse)
{ success: true, data: result }

// Erro (ApiResponse)
{ success: false, error: 'Mensagem de erro' }

// Erro de validação (FormResponse)
{ field: 'email', message: 'O e-mail é inválido.' }
```

---

## 🎯 **QUALIDADE E TIPAGEM**

### **TypeScript Strict**

**✅ NUNCA** usar `any`:

```typescript
// ✅ Correto
function processData(data: unknown): void {
  if (typeof data === "string") {
    console.log(data);
  }
}

// ❌ Incorreto
function processData(data: any): void {
  console.log(data);
}
```

### **Tipos Explícitos**

Todas as funções exportadas devem ter tipos:

```typescript
// ✅ Correto
import type { AuthUser } from "@/lib/db/schema";
import { authUser } from "@/lib/db/schema";

export function getUserByEmail(email: string): Promise<AuthUser | null> {
  return db.query.authUser.findFirst({
    where: eq(authUser.email, email),
  });
}

// ❌ Incorreto
export function getUserByEmail(email) {
  return db.query.authUser.findFirst({
    where: eq(authUser.email, email),
  });
}
```

### **Sem Variáveis Não Utilizadas**

```bash
# Verificar antes de commitar
npm run lint
```

---

## 🕐 **DATAS E TIMEZONE**

### **Timezone de São Paulo**

**✅ SEMPRE** usar timezone de São Paulo:

Arquivo: `src/lib/dateConfig.ts`

```typescript
export const timezone = "America/Sao_Paulo";
```

O projeto centraliza utilitários em `src/lib/dateUtils.ts` e evita dependências extras para timezone,
usando `toLocaleString(..., { timeZone: 'America/Sao_Paulo' })` de forma consistente.

---

## 🌐 **URLS E CONFIGURAÇÃO**

### **Configuração Centralizada**

**✅ SEMPRE** usar `src/lib/config.ts`:

```typescript
import { config } from "@/lib/config";

/**
 * Constrói URL para chamadas de API respeitando o basePath da aplicação.
 *
 * - Em ambiente client, retorna sempre um path relativo (ex.: /silo/api/auth/sign-in/email)
 * - Em ambiente server, concatena APP_URL_DEV/APP_URL_PROD com o path normalizado
 *
 * Exemplo:
 * const url = config.getApiUrl('/api/auth/sign-in/email')
 * // Client: '/silo/api/auth/sign-in/email'
 * // Server (dev): 'http://localhost:3000/silo/api/auth/sign-in/email'
 */
const url = config.getApiUrl("/api/users");
```

### **Nunca Hardcodear URLs**

```typescript
// ❌ Incorreto
const url = "http://localhost:3000/api/users";

// ✅ Correto (usa basePath automaticamente em client/server)
const url = config.getApiUrl("/api/users");
```

### **Produção**

```typescript
export const config = {
  get nodeEnv(): string {
    return process.env.NODE_ENV ?? "development";
  },

  get appUrl(): string {
    const isProd = process.env.NODE_ENV === "production";
    const url = isProd ? process.env.APP_URL_PROD : process.env.APP_URL_DEV;
    if (!url && isProd) {
      throw new Error("APP_URL_PROD deve ser configurada em produção");
    }
    return url || "";
  },

  get databaseUrl(): string {
    const isProd = process.env.NODE_ENV === "production";
    const primary = isProd
      ? process.env.DATABASE_URL_PROD
      : process.env.DATABASE_URL_DEV;
    const fallback = process.env.DATABASE_URL;
    const url = primary || fallback;

    if (!url && isProd) {
      throw new Error("DATABASE_URL_PROD deve ser configurada em produção");
    }

    return url || "";
  },
};
```

---

## ⚛️ **COMPONENTES REACT**

### 🚨 **ALERTA CRÍTICO: Prefetch em Links para APIs**

**⚠️ REGRA OBRIGATÓRIA:** Links do Next.js que apontam para rotas de API (`/api/*`) SEMPRE devem ter `prefetch={false}` ou usar `button` ao invés de `Link`.

**Por quê?**

- Next.js prefetcha automaticamente links visíveis na viewport
- Prefetch de `/api/logout` executa logout sem clique do usuário
- Bug crítico que causa deslogamento imediato após login
- Muito difícil de identificar (levou horas de debug)

**Solução padrão:**

```typescript
// Componentes genéricos devem detectar e desabilitar automaticamente
const isApiRoute = href.startsWith('/api/')
const prefetch = isApiRoute ? false : undefined

return <Link href={href} prefetch={prefetch}>...</Link>
```

**Onde aplicar:**

- Todos os componentes que renderizam links (`Button`, `NavButton`, `TopbarButton`, `AuthLink`, `SidebarMenu`)
- Links específicos de logout (`SidebarFooter`, `TopbarDropdown`)

**Alternativa com button:**

```typescript
// Para ações destrutivas como logout, considere usar button
<button onClick={() => window.location.href='/api/logout'}>
  Sair
</button>
```

### **Tipos de Props**

```typescript
interface ButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
}

export function Button({ label, onClick, disabled }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  )
}
```

### **Hooks Customizados**

```typescript
export function useAsyncState<T>(initialState: T) {
  const [data, setData] = useState<T>(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return { data, setData, isLoading, setIsLoading, error, setError };
}
```

### **Nomes de Funções em Inglês**

```typescript
// ✅ Correto
export function handleSubmit() {}
export function fetchData() {}
export function validateEmail() {}

// ❌ Incorreto
export function enviar() {}
export function buscarDados() {}
export function validarEmail() {}
```

### **Comentários em Português**

```typescript
// Buscar usuários do banco de dados
import type { AuthUser } from "@/lib/db/schema";

async function fetchUsers(): Promise<AuthUser[]> {
  return await db.query.authUser.findMany();
}

// Validar domínio @inpe.br
function isValidDomain(email: string): boolean {
  return email.endsWith("@inpe.br");
}
```

---

## 🔗 **APIS**

### **Estrutura de Rotas**

```text
src/app/api/
├── (user)/              (route group: não aparece na URL)
│   ├── user-profile/
│   └── user-preferences/
├── admin/
│   ├── users/
│   │   └── route.ts
│   └── products/
│       └── route.ts
└── auth/
    ├── login/
    │   └── route.ts
    └── register/
        └── route.ts
```

Observação: pastas entre parênteses (ex.: `(user)`) são apenas organização interna e não fazem parte do path público.
Ex.: `src/app/api/(user)/user-profile/route.ts` atende em `/api/user-profile`.

### **Handler Pattern**

```typescript
import { getAuthUser } from "@/lib/auth/token";

export async function GET(request: NextRequest) {
  try {
    // Validação de autenticação
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 },
      );
    }

    // Lógica de negócio
    const data = await fetchData();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("❌ [API_NAME] Erro", { error });
    return NextResponse.json(
      { success: false, error: "Erro interno" },
      { status: 500 },
    );
  }
}
```

---

## 🗄️ **BANCO DE DADOS**

### **Queries Drizzle**

```typescript
import { db } from "@/lib/db";
import { authUser } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// SELECT
const user = await db.query.authUser.findFirst({
  where: eq(authUser.email, email),
});

// INSERT
await db.insert(authUser).values({
  id: "user-123",
  name: "João Silva",
  email: "joao@inpe.br",
});

// UPDATE
await db
  .update(authUser)
  .set({ name: "João Silva Atualizado" })
  .where(eq(authUser.id, userId));

// DELETE
await db.delete(authUser).where(eq(authUser.id, userId));
```

### **Transações**

```typescript
import { db } from "@/lib/db";
import { authUser, userProfile } from "@/lib/db/schema";

await db.transaction(async (tx) => {
  await tx.insert(authUser).values(user);
  await tx.insert(userProfile).values(profile);
});
```

---

## 🎨 **COMPONENTES UI**

### **Estrutura Padrão**

```typescript
import { Button } from '@/components/ui/Button'

interface ComponentProps {
  title: string
  onAction: () => void
}

export function Component({ title, onAction }: ComponentProps) {
  return (
    <div className="container">
      <h1>{title}</h1>
      <Button onClick={onAction}>Ação</Button>
    </div>
  )
}
```

### **Dark Mode**

```typescript
export function Component() {
  return (
    <div className="bg-white dark:bg-zinc-900">
      <p className="text-gray-900 dark:text-gray-100">
        Conteúdo
      </p>
    </div>
  )
}
```

---

**🎯 Mantenha padrões consistentes em todo o projeto!**
