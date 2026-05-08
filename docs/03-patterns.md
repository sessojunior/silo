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
9. [Linha e Final de Arquivo](#-linha-e-final-de-arquivo)

---

## 🧾 **LINHA E FINAL DE ARQUIVO**

O repositório usa LF como padrão para código, scripts, compose e documentação. Isso fica centralizado em dois arquivos:

- `.gitattributes` garante que o Git normalize textos com `eol=lf` e mantenha CRLF apenas em arquivos Windows explícitos, como `.bat` e `.cmd`.
- `.editorconfig` orienta o editor a salvar com LF e inserir newline final automaticamente.

Na prática:

- Arquivos de código e script devem permanecer em LF.
- Se um arquivo já estiver aberto no editor com CRLF, salve novamente após o `.editorconfig` ser aplicado.
- Evite introduzir CRLF manualmente em shell scripts, compose, TS, MD, YAML e SQL.

Essa política mantém o mesmo comportamento em Windows e Linux sem depender de configuração local de cada máquina.

---

## 📦 **IMPORTS E ESTRUTURA**

### **Imports**

No monorepo, imports seguem duas regras simples:

- **Pacotes compartilhados** (`@silo/*`): use o nome do pacote.
- **Código interno ao app** (`apps/web`): use o alias `@/`.

```typescript
// ✅ Correto — pacotes do monorepo
import { db } from "@silo/database";
import { authUser } from "@silo/database/schema";
import { formatDate } from "@silo/engine/date";
import type { CreateUserDto } from "@silo/engine/contracts/dto/users";

// ✅ Correto — código específico do apps/web (usa @/)
import { config } from "@/lib/config";
import { getAuthUser } from "@/lib/auth/token";
import { MyPageComponent } from "@/components/admin/MyPageComponent";

// ❌ Incorreto — nunca use paths relativos cross-package
import { db } from "../../packages/db/src";
import { sendEmail } from "../../../lib/sendEmail";
```

**Centralizar configurações do web:**

```typescript
// ✅ Correto
import { config } from "@/lib/config";
const apiUrl = config.getApiUrl("/api/auth/get-session");

// ❌ Incorreto
const apiUrl = process.env.API_URL;
```

### **Organização de Imports**

```typescript
// 1. React e Next.js
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 2. Pacotes do monorepo
import { db } from "@silo/database";
import { formatDate } from "@silo/engine/date";

// 3. Bibliotecas externas
import { z } from "zod";

// 4. Imports internos ao app (com @/)
import { config } from "@/lib/config";

// 5. Tipos
import type { AuthUser } from "@silo/database/schema";
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
import { db } from "@silo/database";
import { authUser } from "@silo/database/schema";
import type { InferSelectModel } from "drizzle-orm";

type AuthUser = InferSelectModel<typeof authUser>;

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

```typescript
// ✅ Correto
import { TIMEZONE, formatDate } from "@silo/engine/date";

// ❌ Incorreto
import { timezone } from "@/lib/dateConfig";
```

O projeto centraliza utilitários de data em `packages/engine/src/date/`.

---

## 🌐 **URLS E CONFIGURAÇÃO**

### **Configuração Centralizada**

**✅ SEMPRE** usar `src/lib/config.ts`:

```typescript
import { config } from "@/lib/config";

/**
 * Constrói URL para chamadas de API respeitando o basePath da aplicação.
 *
 * - Em ambiente client, retorna sempre um path relativo (ex.: <BASE_PATH>/api/auth/sign-in/email)
 * - Em ambiente server, concatena APP_URL_DEV/APP_URL_PROD com o path normalizado
 *
 * Exemplo:
 * const url = config.getApiUrl('/api/auth/sign-in/email')
 * // Client: '<BASE_PATH>/api/auth/sign-in/email'
 * // Server (dev): 'http://localhost:3000<BASE_PATH>/api/auth/sign-in/email'
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
    const url = isProd
      ? process.env.DATABASE_URL_PROD
      : process.env.DATABASE_URL_DEV;

    if (!url && isProd) {
      throw new Error("DATABASE_URL_PROD deve ser configurada em produção");
    }

    return url || "";
  },
};
```

---

## ⚛️ **COMPONENTES REACT**

### 🚨 **ALERTA CRÍTICO: Logout via POST**

**⚠️ REGRA OBRIGATÓRIA:** O logout do sistema é executado por `POST` em `/api/auth/sign-out`. Não use `Link` para essa ação; use `button` com `fetch`.

**Por quê?**

- Logout precisa ser uma ação explícita do usuário
- O redirecionamento para `/login` deve acontecer depois da resposta da API
- A confirmação antes da chamada evita disparos acidentais

**Solução padrão:**

```typescript
<button
  onClick={async () => {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      credentials: "include",
    });

    window.location.href = "/login";
  }}
>
  Sair
</button>
```

**Onde aplicar:**

- `SidebarFooter`
- `TopbarDropdown`
- `LogoutContext`

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
apps/web/src/app/api/
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
Ex.: `apps/web/src/app/api/(user)/user-profile/route.ts` atende em `/api/user-profile`.

### **Handler Pattern**

```typescript
import { db } from "@silo/database";
import { getAuthUser } from "@/lib/auth/token"; // web-specific

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
import { db } from "@silo/database";
import { authUser } from "@silo/database/schema";
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
import { db } from "@silo/database";
import { authUser, userProfile } from "@silo/database/schema";

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
