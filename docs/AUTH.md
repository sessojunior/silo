# 🔐 Sistema de Autenticação

Documentação completa sobre autenticação, login, Google OAuth e configuração de segurança.

---

## 📋 **ÍNDICE**

1. [Visão Geral](#-visão-geral)
2. [Métodos de Autenticação](#-métodos-de-autenticação)
3. [Google OAuth](#-google-oauth)
4. [Segurança e Validação](#-segurança-e-validação)
5. [Configuração](#-configuração)
6. [Sistema de Ativação](#-sistema-de-ativação)
7. [Contexto de Usuário](#-contexto-de-usuário)

---

## 🎯 **VISÃO GERAL**

O sistema SILO implementa múltiplos métodos de autenticação com foco em segurança institucional:

- ✅ Login com email e senha
- ✅ Login apenas com email (código OTP)
- ✅ Google OAuth
- ✅ Recuperação de senha
- ✅ Sistema de ativação obrigatória
- ✅ Validação de domínio @inpe.br
- ✅ Rate limiting e proteções

---

## 🔑 **MÉTODOS DE AUTENTICAÇÃO**

A autenticação é gerenciada pelo Better Auth e exposta em `/api/auth/*` pelo handler `src/app/api/auth/[...all]/route.ts`. O frontend usa `authClient` para iniciar login, registro e OTP.

### **1. Login com Email e Senha**

```typescript
const { error } = await authClient.signIn.email({
  email: "usuario@inpe.br",
  password: "SenhaSegura@123",
});
```

**Validações:**

- ✅ Email válido e do domínio @inpe.br
- ✅ Senha entre 8 e 120 caracteres
- ✅ Senha com minúscula, maiúscula, número e caractere especial
- ✅ Usuário ativo

### **2. Login apenas com Email (OTP)**

O código OTP tem **6 dígitos**.

```typescript
await authClient.emailOtp.sendVerificationOtp({
  email: "usuario@inpe.br",
  type: "sign-in",
});

const { error } = await authClient.signIn.emailOtp({
  email: "usuario@inpe.br",
  otp: "347281",
});
```

### **3. Registro de Usuário**

```typescript
const { error } = await authClient.signUp.email({
  name: "João Silva",
  email: "joao.silva@inpe.br",
  password: "SenhaSegura@123",
});

await authClient.emailOtp.sendVerificationOtp({
  email: "joao.silva@inpe.br",
  type: "email-verification",
});
```

**Importante:**

- ⚠️ Usuários criados como **inativos** por padrão
- ⚠️ Necessária ativação por administrador
- ⚠️ Email deve ser do domínio @inpe.br

### **4. Recuperação de Senha**

```typescript
await authClient.emailOtp.sendVerificationOtp({
  email: "usuario@inpe.br",
  type: "forget-password",
});
```

Após receber o OTP, a redefinição é feita no endpoint customizado:

```http
POST /api/auth/setup-password
Content-Type: application/json

{
  "email": "usuario@inpe.br",
  "code": "347281",
  "password": "SenhaSegura@123"
}
```

---

## 🔵 **GOOGLE OAUTH**

### **Configuração**

1. **Criar Projeto no Google Cloud Console**
   - Acesse: <https://console.cloud.google.com>
   - Crie um novo projeto ou selecione existente

2. **Configurar OAuth Consent Screen**
   - Tipo: Internal (para conta @inpe.br)
   - App name: SILO
   - Support email: <seu-email@inpe.br>
   - Developer contact: <seu-email@inpe.br>

3. **Criar Credenciais OAuth**
   - Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Name: SILO Web Client
   - Authorized JavaScript origins: `http://localhost:3000` (dev), `https://fortuna.cptec.inpe.br` (prod)
   - Authorized redirect URIs: `http://localhost:3000/silo/api/auth/callback/google` (dev), `https://fortuna.cptec.inpe.br/silo/api/auth/callback/google` (prod)

4. **Copiar Credenciais**
   - Client ID
   - Client Secret

### **Variáveis de Ambiente**

```bash
# .env
GOOGLE_CLIENT_ID='seu-client-id.apps.googleusercontent.com'
GOOGLE_CLIENT_SECRET='seu-client-secret'
```

### **Arquivo de Configuração**

Arquivo: `src/lib/auth/server.ts`

```typescript
export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});
```

### **Fluxo de Autenticação Google**

- OAuth é iniciado pelas rotas do Better Auth em `/api/auth/*`
- Callback padrão: `/api/auth/callback/google`
- Sessão criada via cookie HTTP-only

---

## 🔒 **SEGURANÇA E VALIDAÇÃO**

### 🚨 **ALERTA CRÍTICO: Prefetch em Links de Logout**

**⚠️ IMPORTANTE:** O Next.js prefetcha automaticamente links visíveis na página. Links para `/api/logout` SEMPRE devem ter `prefetch={false}` ou usar `button` ao invés de `Link`.

**Problema:**

- Next.js prefetcha links automaticamente quando aparecem na viewport
- Se um link apontar para `/api/logout`, pode fazer logout automático sem clique do usuário
- Bug crítico que causa deslogamento imediato após login

**Solução:**

```typescript
// ✅ CORRETO
<Link href='/api/logout' prefetch={false}>Sair</Link>

// ✅ CORRETO - Alternativa com button
<button onClick={() => window.location.href='/api/logout'}>Sair</button>

// ❌ ERRADO - Causa logout automático!
<Link href='/api/logout'>Sair</Link>
```

**Componentes afetados:**

- `src/components/admin/sidebar/SidebarFooter.tsx`
- `src/components/admin/topbar/TopbarDropdown.tsx`
- Componentes genéricos (`Button`, `NavButton`, etc.) devem automaticamente desabilitar prefetch para URLs que começam com `/api/`

**Regra geral:** Se `href.startsWith('/api/')`, SEMPRE usar `prefetch={false}`.

### **Validação de Domínio**

Função centralizada em `src/lib/auth/validate.ts`:

```typescript
export function isValidDomain(email: string): boolean {
  const lowerEmail = email.toLowerCase().trim();
  return lowerEmail.endsWith("@inpe.br");
}
```

**Aplicado em:**

- ✅ Registro de usuários
- ✅ Login por email (OTP)
- ✅ Recuperação de senha
- ✅ Login Google OAuth
- ✅ Alteração de email

### **Rate Limiting**

**Limite padrão:** 3 tentativas por minuto (por combinação de email + IP + rota)

Arquivo: `src/lib/rateLimit.ts`

```typescript
export async function isRateLimited(params: {
  email: string;
  ip: string;
  route: string;
  limit?: number;
  windowInSeconds?: number;
}): Promise<boolean>;

export async function recordRateLimit(params: {
  email: string;
  ip: string;
  route: string;
}): Promise<void>;
```

**Endpoints Protegidos:**

- Envio de códigos OTP (login-email, register, forget-password, setup-password, email-change)

### **Sistema de Senhas**

**Hashing:** bcrypt com salt rounds 10

Arquivo: `src/lib/auth/hash.ts`

```typescript
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### **Sistema de Sessões**

O Better Auth mantém sessões no banco (tabela `session`) e usa cookie HTTP-only `better-auth.session_token`.

### **Obter Usuário Autenticado**

Arquivo: `src/lib/auth/server.ts`

```typescript
export async function getAuthUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user || null;
}
```

---

## ⚙️ **CONFIGURAÇÃO**

### **Variáveis de Ambiente**

```bash
# .env

# URLs do sistema
NEXT_PUBLIC_BASE_PATH='/silo'
APP_URL_DEV='http://localhost:3000/silo'
APP_URL_PROD='https://fortuna.cptec.inpe.br/silo'
BETTER_AUTH_URL='https://fortuna.cptec.inpe.br/silo'

# Google OAuth
GOOGLE_CLIENT_ID='seu-client-id'
GOOGLE_CLIENT_SECRET='seu-client-secret'

# Email (para OTP)
SMTP_HOST='smtp.exemplo.com'
SMTP_PORT='587'
SMTP_SECURE=false # Defina como true se usar SSL (porta 465)
SMTP_USERNAME='usuario@exemplo.com'
SMTP_PASSWORD='senha'
```

### **Obter Usuário Autenticado**

Arquivo: `src/lib/auth/server.ts`

```typescript
export async function getAuthUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user || null;
}
```

---

## ✅ **SISTEMA DE ATIVAÇÃO**

### **Fluxo de Ativação**

1. Usuário se registra → Criado como **inativo** (`isActive: false`)
2. Administrador recebe notificação
3. Administrador acessa `/admin/users`
4. Administrador ativa usuário via toggle
5. Usuário pode fazer login

### **Verificação de Ativação**

Aplicada no hook `before` do Better Auth para as rotas de login com email e OTP:

```typescript
hooks: {
  before: createAuthMiddleware(async (ctx) => {
    const isEmailPasswordSignIn = ctx.path === "/sign-in/email"
    const isEmailOtpSignIn = ctx.path === "/sign-in/email-otp"

    if (!isEmailPasswordSignIn && !isEmailOtpSignIn) return
    const email = ctx.body?.email
    if (!email) return

    const user = await db.query.authUser.findFirst({
      where: eq(authUser.email, email),
    })

    if (user && !user.isActive) {
      throw new APIError("FORBIDDEN", {
        message: "Usuário inativo. Contate o administrador.",
      })
    }
  }),
}
```

### **Proteções de Auto-Modificação**

Usuários **não podem**:

- ❌ Alterar próprio nome via admin
- ❌ Alterar próprio email via admin
- ❌ Desativar própria conta
- ❌ Remover-se do grupo Administradores

```typescript
// Proteção no backend
if (userId === session.userId) {
  return NextResponse.json(
    {
      success: false,
      error: "Você não pode modificar seu próprio usuário",
    },
    { status: 403 },
  );
}
```

---

## 👤 **CONTEXTO DE USUÁRIO**

### **UserContext**

Arquivo: `src/context/UserContext.tsx`

```typescript
export const UserContext = createContext<{
  user: User | null;
  userProfile: UserProfile | null;
  userPreferences: UserPreferences | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}>({
  user: null,
  userProfile: null,
  userPreferences: null,
  isLoading: true,
  refreshUser: async () => {},
});
```

### **Hooks Disponíveis**

```typescript
// Usuário completo
const { user } = useUser();

// Perfil profissional
const { userProfile } = useUserProfile();

// Preferências
const { userPreferences } = useUserPreferences();

// Atualizar dados
const { refreshUser } = useUser();
await refreshUser();
```

### **Hook de Usuário Atual**

Arquivo: `src/hooks/useCurrentUser.ts`

```typescript
export function useCurrentUser() {
  const { data: user, isLoading, mutate } = useSWR("/api/user", fetcher);

  return { user, isLoading, refresh: mutate };
}
```

---

**🎯 Para detalhes técnicos de implementação, consulte o código em `src/lib/auth/` e `src/app/api/auth/`**
